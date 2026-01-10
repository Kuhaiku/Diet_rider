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
            return res.status(403).json({ msg: "Acesso negado." });
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
        db.query('INSERT INTO users SET ?', { name, email, password: hash, can_post: 1, is_owner: 0, likes_public: 1 }, (err) => {
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
        res.json({ token, user: { name: results[0].name, email, id: results[0].id, avatar: results[0].avatar, is_owner: isOwnerEnv ? 1 : 0 } });
    });
});

// --- ROTAS DE PERFIL ---

app.get('/api/public/user/:id', (req, res) => {
    const sql = 'SELECT id, name, avatar, bio, social_links, likes_public, created_at FROM users WHERE id = ?';
    db.query(sql, [req.params.id], (err, results) => {
        if(err) return res.status(500).json({msg: "Erro SQL"});
        if(results.length === 0) return res.status(404).json({msg: "Usuário não encontrado"});
        res.json(results[0]);
    });
});

app.put('/api/user/profile', verifyToken, (req, res) => {
    const { bio, avatar, social_links, likes_public } = req.body;
    const linksJson = JSON.stringify(social_links || []);
    let isPublic = 1;
    if (likes_public !== undefined) {
        isPublic = (likes_public === true || likes_public === 1 || likes_public === '1') ? 1 : 0;
    }
    const sql = 'UPDATE users SET bio = ?, avatar = ?, social_links = ?, likes_public = ? WHERE id = ?';
    db.query(sql, [bio, avatar, linksJson, isPublic, req.userId], (err) => {
        if(err) return res.status(500).json({msg: "Erro ao atualizar perfil"});
        res.json({msg: "Perfil atualizado!"});
    });
});

app.get('/api/public/user/:id/posts', (req, res) => {
    const sql = `
        SELECT p.*, u.name as author_name, u.avatar as author_avatar,
        (SELECT COUNT(*) FROM community_votes v WHERE v.post_id = p.id AND v.vote_type = 'like') as likes_count,
        (SELECT COUNT(*) FROM community_votes v WHERE v.post_id = p.id AND v.vote_type = 'dislike') as dislikes_count
        FROM community_posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.user_id = ?
        ORDER BY p.created_at DESC
    `;
    db.query(sql, [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ msg: "Erro posts" });
        res.json(results);
    });
});

app.get('/api/public/user/:id/likes', verifyToken, (req, res) => {
    const targetUserId = req.params.id;
    const requestingUserId = req.userId;
    db.query('SELECT likes_public FROM users WHERE id = ?', [targetUserId], (err, userRes) => {
        if (err || userRes.length === 0) return res.status(404).json({ msg: "Usuário não encontrado" });
        const isPublic = userRes[0].likes_public === 1;
        const isOwner = parseInt(targetUserId) === requestingUserId;
        if (!isPublic && !isOwner) return res.status(403).json({ msg: "Privado" });

        const sql = `
            SELECT p.*, u.name as author_name, u.avatar as author_avatar,
            (SELECT COUNT(*) FROM community_votes v WHERE v.post_id = p.id AND v.vote_type = 'like') as likes_count,
            (SELECT vote_type FROM community_votes v WHERE v.post_id = p.id AND v.user_id = ?) as my_vote
            FROM community_posts p
            JOIN users u ON p.user_id = u.id
            JOIN community_votes cv ON cv.post_id = p.id
            WHERE cv.user_id = ? AND cv.vote_type = 'like'
            ORDER BY cv.id DESC 
        `;
        db.query(sql, [requestingUserId, targetUserId], (err, results) => {
            if (err) return res.status(500).json({ msg: "Erro SQL" });
            res.json(results);
        });
    });
});

// --- ROTAS DA COMUNIDADE ---

// 1. ROTA DE BUSCA DE USUÁRIOS
app.get('/api/community/users', verifyToken, (req, res) => {
    const search = req.query.q;
    const showAll = req.query.all === 'true'; 

    if (!search || search.trim().length === 0) return res.json([]); 

    const term = `%${search}%`;
    let sql = `SELECT id, name, avatar, bio FROM users WHERE name LIKE ?`;
    
    if (!showAll) {
        sql += ` LIMIT 6`;
    }

    db.query(sql, [term], (err, results) => {
        if (err) return res.status(500).json({ msg: "Erro ao buscar usuários" });
        res.json(results);
    });
});


// 2. Feed Geral com Busca de Posts (ATUALIZADO)
app.get('/api/community/posts', verifyToken, (req, res) => {
    const search = req.query.q;
    let sql = `
        SELECT p.*, u.name as author_name, u.avatar as author_avatar,
        (SELECT COUNT(*) FROM community_votes v WHERE v.post_id = p.id AND v.vote_type = 'like') as likes_count,
        (SELECT COUNT(*) FROM community_votes v WHERE v.post_id = p.id AND v.vote_type = 'dislike') as dislikes_count,
        (SELECT COUNT(*) FROM community_comments c WHERE c.post_id = p.id) as comments_count, 
        (SELECT vote_type FROM community_votes v WHERE v.post_id = p.id AND v.user_id = ?) as my_vote
        FROM community_posts p
        JOIN users u ON p.user_id = u.id
    `;
    const params = [req.userId];
    
    if (search) {
        sql += ` WHERE p.title LIKE ? OR p.description LIKE ? OR u.name LIKE ?`;
        const term = `%${search}%`;
        params.push(term, term, term);
    }
    
    sql += ` ORDER BY p.created_at DESC LIMIT 50`;
    
    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ msg: "Erro posts" });
        res.json(results);
    });
});

app.post('/api/community/post', verifyToken, (req, res) => {
    const { title, description, youtube_link, content_json } = req.body;
    db.query('SELECT can_post FROM users WHERE id = ?', [req.userId], (err, results) => {
        if (err) return res.status(500).json({msg: "Erro DB"});
        if (results[0].can_post === 0) return res.status(403).json({msg: "Proibido postar."});
        const sql = 'INSERT INTO community_posts (user_id, title, description, youtube_link, content_json) VALUES (?, ?, ?, ?, ?)';
        db.query(sql, [req.userId, title, description, youtube_link, JSON.stringify(content_json)], (err) => {
            if (err) return res.status(500).json({ msg: "Erro ao postar" });
            res.json({ msg: "Postado!" });
        });
    });
});

// --- ROTAS DE COMENTÁRIOS ---

// Listar comentários de um post
app.get('/api/community/post/:id/comments', verifyToken, (req, res) => {
    const sql = `
        SELECT c.*, u.name as author_name, u.avatar as author_avatar, u.id as author_id
        FROM community_comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.post_id = ?
        ORDER BY c.created_at ASC
    `;
    db.query(sql, [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ msg: "Erro ao buscar comentários" });
        res.json(results);
    });
});

// Adicionar comentário
app.post('/api/community/post/:id/comment', verifyToken, (req, res) => {
    const { comment } = req.body;
    if (!comment || comment.trim().length === 0) return res.status(400).json({ msg: "Comentário vazio" });
    
    const sql = 'INSERT INTO community_comments (post_id, user_id, comment) VALUES (?, ?, ?)';
    db.query(sql, [req.params.id, req.userId, comment], (err) => {
        if (err) return res.status(500).json({ msg: "Erro ao comentar" });
        res.json({ msg: "Comentário adicionado" });
    });
});

// Deletar comentário (Dono do comentário ou Dono do Sistema)
app.delete('/api/community/comment/:id', verifyToken, (req, res) => {
    db.query('SELECT user_id FROM community_comments WHERE id = ?', [req.params.id], (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ msg: "Comentário não encontrado" });
        const commentOwnerId = results[0].user_id;
        
        db.query('SELECT email FROM users WHERE id = ?', [req.userId], (err, userRes) => {
            const isSystemOwner = (userRes[0].email === process.env.OWNER_EMAIL);
            
            if (req.userId !== commentOwnerId && !isSystemOwner) {
                return res.status(403).json({ msg: "Não autorizado" });
            }
            
            db.query('DELETE FROM community_comments WHERE id = ?', [req.params.id], (err) => {
                if (err) return res.status(500).json({ msg: "Erro ao deletar" });
                res.json({ msg: "Comentário removido" });
            });
        });
    });
});

app.post('/api/community/vote', verifyToken, (req, res) => {
    const { post_id, vote_type } = req.body; 
    db.query('SELECT * FROM community_votes WHERE post_id = ? AND user_id = ?', [post_id, req.userId], (err, results) => {
        if (err) return res.status(500).json({ msg: "Erro SQL" });
        if (results.length > 0) {
            const currentVote = results[0].vote_type;
            if (currentVote === vote_type) {
                db.query('DELETE FROM community_votes WHERE id = ?', [results[0].id], (err) => res.json({ msg: "Removido" }));
            } else {
                db.query('UPDATE community_votes SET vote_type = ? WHERE id = ?', [vote_type, results[0].id], (err) => res.json({ msg: "Atualizado" }));
            }
        } else {
            db.query('INSERT INTO community_votes (post_id, user_id, vote_type) VALUES (?, ?, ?)', [post_id, req.userId, vote_type], (err) => res.json({ msg: "Computado" }));
        }
    });
});

app.delete('/api/community/post/:id', verifyToken, (req, res) => {
    db.query('SELECT user_id FROM community_posts WHERE id = ?', [req.params.id], (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ msg: "Post não encontrado" });
        const postOwnerId = results[0].user_id;
        db.query('SELECT email FROM users WHERE id = ?', [req.userId], (err, userRes) => {
            const currentUserEmail = userRes[0].email;
            const isSystemOwner = (currentUserEmail === process.env.OWNER_EMAIL);
            if (req.userId !== postOwnerId && !isSystemOwner) return res.status(403).json({ msg: "Não autorizado" });
            db.query('DELETE FROM community_posts WHERE id = ?', [req.params.id], (err) => res.json({ msg: "Deletado" }));
        });
    });
});

// --- ROTAS DE CONFIG E DADOS PESSOAIS ---

// Rotas de Receitas (Library)
app.get('/api/library', verifyToken, (req, res) => { 
    db.query('SELECT data FROM recipes WHERE user_id = ?', [req.userId], (err, r) => res.json(r ? r.map(x=>x.data) : [])); 
});
app.post('/api/library', verifyToken, (req, res) => { 
    const r=req.body; 
    db.query('DELETE FROM recipes WHERE user_id=? AND front_id=?',[req.userId,r.id],()=>{ 
        db.query('INSERT INTO recipes (user_id,front_id,data) VALUES (?,?,?)',[req.userId,r.id,JSON.stringify(r)],(e)=>res.json({msg:"Salvo"})) 
    }); 
});

// !!! NOVA ROTA ADICIONADA: EXCLUIR RECEITA !!!
app.delete('/api/library/:id', verifyToken, (req, res) => {
    db.query('DELETE FROM recipes WHERE user_id = ? AND front_id = ?', [req.userId, req.params.id], (err, result) => {
        if (err) return res.status(500).json({ msg: "Erro ao deletar receita" });
        res.json({ msg: "Receita deletada!" });
    });
});

// Rotas de Presets (Planos Salvos)
app.get('/api/presets', verifyToken, (req, res) => { 
    db.query('SELECT data FROM saved_plans WHERE user_id = ? ORDER BY created_at DESC', [req.userId], (err, r) => res.json(r ? r.map(x=>x.data) : [])); 
});
app.post('/api/presets', verifyToken, (req, res) => { 
    const p=req.body; 
    db.query('INSERT INTO saved_plans (user_id,front_id,name,data) VALUES (?,?,?,?)',[req.userId,p.id,p.name,JSON.stringify(p)],(e)=>res.json({msg:"Salvo"})); 
});
app.put('/api/presets/:id', verifyToken, (req, res) => { 
    const { name } = req.body; 
    db.query('SELECT data FROM saved_plans WHERE user_id = ? AND front_id = ?', [req.userId, req.params.id], (err, results) => { 
        if (err || results.length === 0) return res.status(500).json({ error: "Erro/Não encontrado" }); 
        let planData = results[0].data; planData.name = name; 
        db.query('UPDATE saved_plans SET name = ?, data = ? WHERE user_id = ? AND front_id = ?', [name, JSON.stringify(planData), req.userId, req.params.id], (err) => { 
            if (err) return res.status(500).json({ msg: "Erro SQL" }); res.json({ msg: "Renomeado" }); 
        }); 
    }); 
});
app.delete('/api/presets/:id', verifyToken, (req, res) => { 
    db.query('DELETE FROM saved_plans WHERE user_id = ? AND front_id = ?', [req.userId, req.params.id], (err) => { 
        if (err) return res.status(500).json({ msg: "Erro SQL" }); res.json({ msg: "Preset Deletado" }); 
    }); 
});

// Rotas do Planner (Estado Atual)
app.get('/api/planner', verifyToken, (req, res) => { 
    db.query('SELECT planner_data, themes_data FROM app_state WHERE user_id = ?', [req.userId], (err, results) => { 
        if (err) return res.status(500).json({ msg: "Erro SQL" }); res.json(results[0] || { planner_data: {}, themes_data: {} }); 
    }); 
});
app.post('/api/planner', verifyToken, (req, res) => { 
    const { planner, themes } = req.body; 
    const sql = `INSERT INTO app_state (user_id, planner_data, themes_data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE planner_data = VALUES(planner_data), themes_data = VALUES(themes_data)`; 
    db.query(sql, [req.userId, JSON.stringify(planner), JSON.stringify(themes)], (err) => { 
        if (err) return res.status(500).json({ msg: "Erro SQL" }); res.json({ msg: "Estado Salvo" }); 
    }); 
});

// --- ADMIN STATS ---
app.get('/api/owner/stats', verifyToken, verifyOwner, (req, res) => {
    const qUsers = new Promise((resolve, reject) => db.query('SELECT COUNT(*) as total FROM users', (err, res) => err ? reject(err) : resolve(res[0].total)));
    const qPosts = new Promise((resolve, reject) => db.query('SELECT COUNT(*) as total FROM community_posts', (err, res) => err ? reject(err) : resolve(res[0].total)));
    const qReports = new Promise((resolve, reject) => db.query('SELECT COUNT(*) as total FROM community_reports WHERE status = "pending"', (err, res) => err ? reject(err) : resolve(res[0].total)));
    Promise.all([qUsers, qPosts, qReports]).then(([users, posts, reports]) => res.json({ users, posts, reports })).catch(err => res.status(500).json({ msg: "Erro" }));
});

app.listen(3000, () => console.log('🚀 API Rodando na porta 3000'));