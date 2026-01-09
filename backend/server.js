const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '50mb' })); 
app.use(cors());

// --- CONEXÃO BANCO ---
const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// --- MIDDLEWARES ---

function verifyToken(req, res, next) {
    const tokenHeader = req.headers['authorization'];
    if (!tokenHeader) return res.status(403).json({ msg: "Token ausente" });
    const token = tokenHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ msg: "Token inválido" });
        req.userId = decoded.id;
        next();
    });
}

function verifyOwner(req, res, next) {
    db.query('SELECT email FROM users WHERE id = ?', [req.userId], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ msg: "Erro verificação owner" });
        
        const userEmail = results[0].email;
        const ownerEmail = process.env.OWNER_EMAIL;

        if (userEmail !== ownerEmail) {
            return res.status(403).json({ msg: "Acesso negado. Apenas o Dono Supremo." });
        }
        next();
    });
}

// --- ROTAS DE AUTH ---

app.post('/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    db.query('SELECT email FROM users WHERE email = ?', [email], async (err, results) => {
        if (results.length > 0) return res.status(400).json({ msg: 'Email já existe.' });
        const hash = await bcrypt.hash(password, 8);
        db.query('INSERT INTO users SET ?', { name, email, password: hash, can_post: 1, is_owner: 0 }, (err) => {
            if (err) return res.status(500).json({ error: err });
            res.status(201).json({ msg: 'Criado!' });
        });
    });
});

app.post('/auth/login', (req, res) => {
    const { email, password } = req.body;
    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (results.length === 0 || !(await bcrypt.compare(password, results[0].password))) {
            return res.status(401).json({ msg: 'Dados incorretos.' });
        }
        
        const isOwnerEnv = (email === process.env.OWNER_EMAIL);

        const token = jwt.sign({ id: results[0].id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        
        res.json({ 
            token, 
            user: { 
                name: results[0].name, 
                email, 
                id: results[0].id,
                avatar: results[0].avatar, // Retorna avatar no login
                is_owner: isOwnerEnv ? 1 : 0 
            } 
        });
    });
});

// --- ROTAS DE PERFIL (NOVAS) ---

// 1. Perfil Público (Qualquer um vê)
app.get('/api/public/user/:id', (req, res) => {
    const sql = 'SELECT id, name, avatar, bio, social_links, created_at FROM users WHERE id = ?';
    db.query(sql, [req.params.id], (err, results) => {
        if(err) return res.status(500).json({msg: "Erro SQL"});
        if(results.length === 0) return res.status(404).json({msg: "Usuário não encontrado"});
        res.json(results[0]);
    });
});

// 2. Posts de um Usuário Específico (Público)
app.get('/api/public/user/:id/posts', (req, res) => {
    // Busca posts do usuário específico
    const sql = `
        SELECT 
            p.*, 
            u.name as author_name,
            u.avatar as author_avatar,
            (SELECT COUNT(*) FROM community_votes v WHERE v.post_id = p.id AND v.vote_type = 'like') as likes_count
        FROM community_posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.user_id = ?
        ORDER BY p.created_at DESC
    `;
    db.query(sql, [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ msg: "Erro ao buscar posts" });
        res.json(results);
    });
});

// 3. Atualizar Meu Perfil (Protegido)
app.put('/api/user/profile', verifyToken, (req, res) => {
    const { bio, avatar, social_links } = req.body;
    
    // Converte array de links para JSON string se necessário
    const linksJson = JSON.stringify(social_links || []);

    const sql = 'UPDATE users SET bio = ?, avatar = ?, social_links = ? WHERE id = ?';
    db.query(sql, [bio, avatar, linksJson, req.userId], (err) => {
        if(err) return res.status(500).json({msg: "Erro ao atualizar perfil"});
        res.json({msg: "Perfil atualizado!"});
    });
});


// --- ROTAS DA COMUNIDADE (ATUALIZADAS) ---

app.post('/api/community/post', verifyToken, (req, res) => {
    const { title, description, youtube_link, content_json } = req.body;

    db.query('SELECT can_post FROM users WHERE id = ?', [req.userId], (err, results) => {
        if (err) return res.status(500).json({msg: "Erro verificar user"});
        if (results[0].can_post === 0) return res.status(403).json({msg: "Você está proibido de postar."});

        if (youtube_link) {
            const ytRegex = /^(https?\:\/\/)?(www\.youtube\.com|youtu\.?be)\/.+$/;
            if (!ytRegex.test(youtube_link)) return res.status(400).json({msg: "Link inválido."});
        }

        const sql = 'INSERT INTO community_posts (user_id, title, description, youtube_link, content_json) VALUES (?, ?, ?, ?, ?)';
        db.query(sql, [req.userId, title, description, youtube_link, JSON.stringify(content_json)], (err) => {
            if (err) return res.status(500).json({ msg: "Erro ao postar" });
            res.json({ msg: "Postado com sucesso!" });
        });
    });
});

// Feed Geral (Inclui Avatar do Autor)
app.get('/api/community/posts', verifyToken, (req, res) => {
    const sql = `
        SELECT 
            p.*, 
            u.name as author_name,
            u.avatar as author_avatar,
            (SELECT COUNT(*) FROM community_votes v WHERE v.post_id = p.id AND v.vote_type = 'like') as likes_count,
            (SELECT COUNT(*) FROM community_votes v WHERE v.post_id = p.id AND v.vote_type = 'dislike') as dislikes_count,
            (SELECT vote_type FROM community_votes v WHERE v.post_id = p.id AND v.user_id = ?) as my_vote
        FROM community_posts p
        JOIN users u ON p.user_id = u.id
        ORDER BY (likes_count - dislikes_count) DESC, p.created_at DESC
        LIMIT 50
    `;
    db.query(sql, [req.userId], (err, results) => {
        if (err) return res.status(500).json({ msg: "Erro ao buscar posts" });
        res.json(results);
    });
});

// Um Post Específico (Para Deep Link)
app.get('/api/community/post/:id', verifyToken, (req, res) => {
    const sql = `
        SELECT p.*, u.name as author_name, u.avatar as author_avatar,
        (SELECT COUNT(*) FROM community_votes v WHERE v.post_id = p.id AND v.vote_type = 'like') as likes_count,
        (SELECT COUNT(*) FROM community_votes v WHERE v.post_id = p.id AND v.vote_type = 'dislike') as dislikes_count,
        (SELECT vote_type FROM community_votes v WHERE v.post_id = p.id AND v.user_id = ?) as my_vote
        FROM community_posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.id = ?
    `;
    db.query(sql, [req.userId, req.params.id], (err, results) => {
        if (err) return res.status(500).json({ msg: "Erro SQL" });
        if (results.length === 0) return res.status(404).json({ msg: "Post não encontrado" });
        res.json(results[0]);
    });
});

app.post('/api/community/vote', verifyToken, (req, res) => {
    const { post_id, vote_type } = req.body; 
    db.query('DELETE FROM community_votes WHERE post_id = ? AND user_id = ?', [post_id, req.userId], () => {
        db.query('INSERT INTO community_votes (post_id, user_id, vote_type) VALUES (?, ?, ?)', 
            [post_id, req.userId, vote_type], (err) => {
            if (err) return res.status(500).json({ msg: "Erro ao votar" });
            res.json({ msg: "Voto computado" });
        });
    });
});

app.delete('/api/community/post/:id', verifyToken, (req, res) => {
    db.query('SELECT user_id FROM community_posts WHERE id = ?', [req.params.id], (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ msg: "Post não encontrado" });
        
        const postOwnerId = results[0].user_id;
        db.query('SELECT email FROM users WHERE id = ?', [req.userId], (err, userRes) => {
            if (err) return res.status(500).json({ msg: "Erro permissão" });

            const currentUserEmail = userRes[0].email;
            const isSystemOwner = (currentUserEmail === process.env.OWNER_EMAIL);

            if (req.userId !== postOwnerId && !isSystemOwner) {
                return res.status(403).json({ msg: "Não autorizado" });
            }

            db.query('DELETE FROM community_posts WHERE id = ?', [req.params.id], (err) => {
                if (err) return res.status(500).json({ msg: "Erro ao deletar" });
                res.json({ msg: "Post deletado" });
            });
        });
    });
});

app.post('/api/community/report', verifyToken, (req, res) => {
    const { post_id, reason } = req.body;
    db.query('INSERT INTO community_reports (post_id, reporter_user_id, reason) VALUES (?, ?, ?)',
        [post_id, req.userId, reason], (err) => {
        if (err) return res.status(500).json({ msg: "Erro ao denunciar" });
        res.json({ msg: "Denúncia enviada" });
    });
});

// --- ROTAS ANTIGAS (LIBRARY, PLANNER, PRESETS) ---
// Mantidas para compatibilidade total

app.get('/api/library', verifyToken, (req, res) => {
    db.query('SELECT data FROM recipes WHERE user_id = ?', [req.userId], (err, results) => {
        if (err) return res.status(500).json({ msg: "Erro SQL" });
        res.json(results.map(r => r.data));
    });
});

app.post('/api/library', verifyToken, (req, res) => {
    const recipe = req.body;
    db.query('DELETE FROM recipes WHERE user_id = ? AND front_id = ?', [req.userId, recipe.id], () => {
        db.query('INSERT INTO recipes (user_id, front_id, data) VALUES (?, ?, ?)', 
            [req.userId, recipe.id, JSON.stringify(recipe)], (err) => {
            if (err) return res.status(500).json({ msg: "Erro SQL" });
            res.json({ msg: "Salvo" });
        });
    });
});

app.delete('/api/library/:id', verifyToken, (req, res) => {
    db.query('DELETE FROM recipes WHERE user_id = ? AND front_id = ?', [req.userId, req.params.id], (err) => {
        if (err) return res.status(500).json({ msg: "Erro SQL" });
        res.json({ msg: "Deletado" });
    });
});

app.get('/api/planner', verifyToken, (req, res) => {
    db.query('SELECT planner_data, themes_data FROM app_state WHERE user_id = ?', [req.userId], (err, results) => {
        if (err) return res.status(500).json({ msg: "Erro SQL" });
        res.json(results[0] || { planner_data: {}, themes_data: {} });
    });
});

app.post('/api/planner', verifyToken, (req, res) => {
    const { planner, themes } = req.body;
    const sql = `INSERT INTO app_state (user_id, planner_data, themes_data) VALUES (?, ?, ?) 
                 ON DUPLICATE KEY UPDATE planner_data = VALUES(planner_data), themes_data = VALUES(themes_data)`;
    db.query(sql, [req.userId, JSON.stringify(planner), JSON.stringify(themes)], (err) => {
        if (err) return res.status(500).json({ msg: "Erro SQL" });
        res.json({ msg: "Estado Salvo" });
    });
});

app.get('/api/presets', verifyToken, (req, res) => {
    db.query('SELECT data FROM saved_plans WHERE user_id = ? ORDER BY created_at DESC', [req.userId], (err, results) => {
        if (err) return res.status(500).json({ msg: "Erro SQL" });
        res.json(results.map(r => r.data));
    });
});

app.post('/api/presets', verifyToken, (req, res) => {
    const plan = req.body;
    db.query('INSERT INTO saved_plans (user_id, front_id, name, data) VALUES (?, ?, ?, ?)', 
        [req.userId, plan.id, plan.name, JSON.stringify(plan)], (err) => {
        if (err) return res.status(500).json({ msg: "Erro SQL" });
        res.json({ msg: "Preset Salvo" });
    });
});

app.put('/api/presets/:id', verifyToken, (req, res) => {
    const { name } = req.body;
    db.query('SELECT data FROM saved_plans WHERE user_id = ? AND front_id = ?', [req.userId, req.params.id], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ error: "Erro/Não encontrado" });
        let planData = results[0].data;
        planData.name = name;
        db.query('UPDATE saved_plans SET name = ?, data = ? WHERE user_id = ? AND front_id = ?', 
            [name, JSON.stringify(planData), req.userId, req.params.id], (err) => {
            if (err) return res.status(500).json({ msg: "Erro SQL" });
            res.json({ msg: "Renomeado" });
        });
    });
});

app.delete('/api/presets/:id', verifyToken, (req, res) => {
    db.query('DELETE FROM saved_plans WHERE user_id = ? AND front_id = ?', [req.userId, req.params.id], (err) => {
        if (err) return res.status(500).json({ msg: "Erro SQL" });
        res.json({ msg: "Preset Deletado" });
    });
});

// --- ADMIN / OWNER STATS ---

app.get('/api/owner/stats', verifyToken, verifyOwner, (req, res) => {
    const stats = {};
    const qUsers = new Promise((resolve, reject) => db.query('SELECT COUNT(*) as total FROM users', (err, res) => err ? reject(err) : resolve(res[0].total)));
    const qPosts = new Promise((resolve, reject) => db.query('SELECT COUNT(*) as total FROM community_posts', (err, res) => err ? reject(err) : resolve(res[0].total)));
    const qReports = new Promise((resolve, reject) => db.query('SELECT COUNT(*) as total FROM community_reports WHERE status = "pending"', (err, res) => err ? reject(err) : resolve(res[0].total)));

    Promise.all([qUsers, qPosts, qReports])
        .then(([users, posts, reports]) => res.json({ users, posts, reports }))
        .catch(err => res.status(500).json({ msg: "Erro ao buscar stats" }));
});

app.get('/api/owner/users', verifyToken, verifyOwner, (req, res) => {
    db.query('SELECT id, name, email, can_post, created_at FROM users ORDER BY id DESC', (err, results) => {
        if (err) return res.status(500).json({ msg: "Erro SQL" });
        res.json(results);
    });
});

app.get('/api/owner/all_posts', verifyToken, verifyOwner, (req, res) => {
    const sql = `
        SELECT p.*, u.name as author_name, u.email as author_email,
        (SELECT COUNT(*) FROM community_reports r WHERE r.post_id = p.id) as report_count
        FROM community_posts p
        JOIN users u ON p.user_id = u.id
        ORDER BY p.created_at DESC
        LIMIT 100
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ msg: "Erro SQL" });
        res.json(results);
    });
});

app.get('/api/owner/reports', verifyToken, verifyOwner, (req, res) => {
    const sql = `
        SELECT r.*, p.title as post_title, u.email as reporter_email 
        FROM community_reports r
        JOIN community_posts p ON r.post_id = p.id
        JOIN users u ON r.reporter_user_id = u.id
        WHERE r.status = 'pending'
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ msg: "Erro SQL" });
        res.json(results);
    });
});

app.post('/api/owner/ban', verifyToken, verifyOwner, (req, res) => {
    const { email, can_post } = req.body; 
    db.query('UPDATE users SET can_post = ? WHERE email = ?', [can_post, email], (err, result) => {
        if (err) return res.status(500).json({ msg: "Erro SQL" });
        if (result.affectedRows === 0) return res.status(404).json({ msg: "Usuário não encontrado" });
        res.json({ msg: `Usuário ${can_post ? 'liberado' : 'banido'}.` });
    });
});

app.listen(3000, () => console.log('🚀 API Rodando na porta 3000'));