const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
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
    queueLimit: 0
});

// --- EMAIL CONFIG ---
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: true,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// --- MIDDLEWARE DE SEGURANÇA ---
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

// --- ROTAS DE AUTH (Mantidas) ---
app.post('/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    db.query('SELECT email FROM users WHERE email = ?', [email], async (err, results) => {
        if (results.length > 0) return res.status(400).json({ msg: 'Email já existe.' });
        const hash = await bcrypt.hash(password, 8);
        db.query('INSERT INTO users SET ?', { name, email, password: hash }, (err) => {
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
        const token = jwt.sign({ id: results[0].id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { name: results[0].name, email } });
    });
});

// --- NOVAS ROTAS DE DADOS (MySQL) ---

// 1. BIBLIOTECA
app.get('/api/library', verifyToken, (req, res) => {
    db.query('SELECT data FROM recipes WHERE user_id = ?', [req.userId], (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results.map(r => r.data));
    });
});

app.post('/api/library', verifyToken, (req, res) => {
    const recipe = req.body;
    // Remove anterior se existir e insere novo (Simples e eficaz)
    db.query('DELETE FROM recipes WHERE user_id = ? AND front_id = ?', [req.userId, recipe.id], () => {
        db.query('INSERT INTO recipes (user_id, front_id, data) VALUES (?, ?, ?)', 
            [req.userId, recipe.id, JSON.stringify(recipe)], (err) => {
            if (err) return res.status(500).send(err);
            res.json({ msg: "Salvo" });
        });
    });
});

app.delete('/api/library/:id', verifyToken, (req, res) => {
    db.query('DELETE FROM recipes WHERE user_id = ? AND front_id = ?', [req.userId, req.params.id], (err) => {
        if (err) return res.status(500).send(err);
        res.json({ msg: "Deletado" });
    });
});

// 2. PLANEJADOR (ESTADO)
app.get('/api/planner', verifyToken, (req, res) => {
    db.query('SELECT planner_data, themes_data FROM app_state WHERE user_id = ?', [req.userId], (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results[0] || { planner_data: {}, themes_data: {} });
    });
});

app.post('/api/planner', verifyToken, (req, res) => {
    const { planner, themes } = req.body;
    const sql = `INSERT INTO app_state (user_id, planner_data, themes_data) VALUES (?, ?, ?) 
                 ON DUPLICATE KEY UPDATE planner_data = VALUES(planner_data), themes_data = VALUES(themes_data)`;
    db.query(sql, [req.userId, JSON.stringify(planner), JSON.stringify(themes)], (err) => {
        if (err) return res.status(500).send(err);
        res.json({ msg: "Estado Salvo" });
    });
});

// 3. PLANOS SALVOS (PRESETS)
app.get('/api/presets', verifyToken, (req, res) => {
    db.query('SELECT data FROM saved_plans WHERE user_id = ? ORDER BY created_at DESC', [req.userId], (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results.map(r => r.data));
    });
});

app.post('/api/presets', verifyToken, (req, res) => {
    const plan = req.body;
    db.query('INSERT INTO saved_plans (user_id, front_id, name, data) VALUES (?, ?, ?, ?)', 
        [req.userId, plan.id, plan.name, JSON.stringify(plan)], (err) => {
        if (err) return res.status(500).send(err);
        res.json({ msg: "Preset Salvo" });
    });
});

app.delete('/api/presets/:id', verifyToken, (req, res) => {
    db.query('DELETE FROM saved_plans WHERE user_id = ? AND front_id = ?', [req.userId, req.params.id], (err) => {
        if (err) return res.status(500).send(err);
        res.json({ msg: "Preset Deletado" });
    });
});

app.listen(3000, () => console.log('🚀 API Rodando na porta 3000'));