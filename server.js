require('dotenv').config();
const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

let pool;

async function connectToDatabase() {
    try {
        pool = mysql.createPool(dbConfig);
        await pool.getConnection();
        console.log("Conexão com o MySQL estabelecida com sucesso!");
    } catch (error) {
        console.error("Erro ao conectar com o MySQL:", error);
        setTimeout(connectToDatabase, 5000);
    }
}

// --- ROTAS DA API ---

// == USUÁRIOS ==
app.post('/api/users/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Nome de usuário e senha são obrigatórios.' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
        res.status(201).json({ id: result.insertId, username });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Nome de usuário já existe.' });
        res.status(500).json({ message: 'Erro no servidor ao registrar usuário.', error: error.message });
    }
});

app.post('/api/users/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        const user = rows[0];
        if (user && await bcrypt.compare(password, user.password)) {
            res.status(200).json({ message: 'Login bem-sucedido!', userId: user.id, username: user.username });
        } else {
            res.status(401).json({ message: 'Credenciais inválidas.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Erro no servidor durante o login.', error: error.message });
    }
});

// == CAMPEONATOS ==
app.get('/api/tournaments', async (req, res) => {
    try {
        const [tournaments] = await pool.query('SELECT * FROM tournaments');
        const response = await Promise.all(tournaments.map(async (t) => {
            const [participants] = await pool.query('SELECT user_id AS id FROM participants WHERE tournament_id = ?', [t.id]);
            return { ...t, participants };
        }));
        res.status(200).json(response);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar campeonatos.', error: error.message });
    }
});

app.get('/api/tournaments/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [tRows] = await pool.query('SELECT * FROM tournaments WHERE id = ?', [id]);
        if (tRows.length === 0) return res.status(404).json({ message: 'Campeonato não encontrado.' });
        const tournament = tRows[0];
        const [participants] = await pool.query('SELECT u.id, u.username FROM participants p JOIN users u ON p.user_id = u.id WHERE p.tournament_id = ?', [id]);
        const [matchesData] = await pool.query(`SELECT m.id, m.status, m.score, m.winner_id, p1.id as player1_id, p1.username as player1_username, p2.id as player2_id, p2.username as player2_username FROM matches m JOIN users p1 ON m.player1_id = p1.id JOIN users p2 ON m.player2_id = p2.id WHERE m.tournament_id = ?`, [id]);
        const rankingQuery = `SELECT p.user_id, u.username, COUNT(m.winner_id) * 3 AS points FROM participants p JOIN users u ON p.user_id = u.id LEFT JOIN matches m ON p.user_id = m.winner_id AND m.tournament_id = ? WHERE p.tournament_id = ? GROUP BY p.user_id, u.username ORDER BY points DESC;`;
        const [ranking] = await pool.query(rankingQuery, [id, id]);
        const formattedMatches = matchesData.map(m => ({ id: m.id, status: m.status, score: m.score, winner_id: m.winner_id, player1: { id: m.player1_id, username: m.player1_username }, player2: { id: m.player2_id, username: m.player2_username } }));
        res.status(200).json({ ...tournament, participants, matches: formattedMatches, ranking });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar detalhes do campeonato.', error: error.message });
    }
});

app.post('/api/tournaments/:id/join', async (req, res) => {
    const tournamentId = req.params.id;
    const { userId } = req.body;
    try {
        await pool.query('INSERT INTO participants (tournament_id, user_id) VALUES (?, ?)', [tournamentId, userId]);
        
        // LÓGICA DE NOTIFICAÇÃO: Inserir notificação de inscrição
        const [tRows] = await pool.query('SELECT name FROM tournaments WHERE id = ?', [tournamentId]);
        const message = `Você se inscreveu no campeonato: ${tRows[0].name}`;
        await pool.query('INSERT INTO notifications (user_id, message) VALUES (?, ?)', [userId, message]);
        
        res.status(200).json({ message: 'Inscrição realizada com sucesso!' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Usuário já inscrito.' });
        res.status(500).json({ message: 'Erro ao se inscrever.', error: error.message });
    }
});

// == PARTIDAS ==
app.post('/api/tournaments/:id/matches', async (req, res) => {
    const tournamentId = req.params.id;
    const { player1Id, player2Id } = req.body;
    try {
        const [result] = await pool.query('INSERT INTO matches (tournament_id, player1_id, player2_id) VALUES (?, ?, ?)', [tournamentId, player1Id, player2Id]);
        
        // LÓGICA DE NOTIFICAÇÃO: Notificar ambos os jogadores sobre a nova partida
        const [[p1]] = await pool.query('SELECT username FROM users WHERE id = ?', [player1Id]);
        const [[p2]] = await pool.query('SELECT username FROM users WHERE id = ?', [player2Id]);
        
        await pool.query('INSERT INTO notifications (user_id, message) VALUES (?, ?)', [player1Id, `Nova partida criada contra ${p2.username}.`]);
        await pool.query('INSERT INTO notifications (user_id, message) VALUES (?, ?)', [player2Id, `Nova partida criada contra ${p1.username}.`]);

        res.status(201).json({ id: result.insertId });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao criar partida.', error: error.message });
    }
});

app.put('/api/matches/:matchId/result', async (req, res) => {
    const { matchId } = req.params;
    const { winnerId, score } = req.body;
    try {
        const [[match]] = await pool.query('SELECT player1_id, player2_id FROM matches WHERE id = ?', [matchId]);
        if (!match) return res.status(404).json({ message: "Partida não encontrada." });

        await pool.query("UPDATE matches SET winner_id = ?, score = ?, status = 'Finalizada' WHERE id = ?", [winnerId, score, matchId]);
        
        // LÓGICA DE NOTIFICAÇÃO: Notificar vencedor e perdedor
        const loserId = match.player1_id === winnerId ? match.player2_id : match.player1_id;
        const [[winner]] = await pool.query('SELECT username FROM users WHERE id = ?', [winnerId]);
        const [[loser]] = await pool.query('SELECT username FROM users WHERE id = ?', [loserId]);
        
        await pool.query('INSERT INTO notifications (user_id, message) VALUES (?, ?)', [winnerId, `Você VENCEU a partida contra ${loser.username} (${score})!`]);
        await pool.query('INSERT INTO notifications (user_id, message) VALUES (?, ?)', [loserId, `Você PERDEU a partida contra ${winner.username} (${score}).`]);

        res.status(200).json({ message: 'Resultado registrado com sucesso!' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao registrar resultado.', error: error.message });
    }
});

// == NOTIFICAÇÕES ==
app.get('/api/notifications/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        // Busca notificações não lidas
        const [notifications] = await pool.query(
            'SELECT * FROM notifications WHERE user_id = ? AND is_read = FALSE ORDER BY created_at DESC',
            [userId]
        );

        if (notifications.length > 0) {
            // Marca as notificações buscadas como lidas
            const notificationIds = notifications.map(n => n.id);
            await pool.query('UPDATE notifications SET is_read = TRUE WHERE id IN (?)', [notificationIds]);
        }
        
        res.status(200).json(notifications);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar notificações.', error: error.message });
    }
});


// --- Iniciando o Servidor ---
connectToDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Servidor rodando na porta http://localhost:${PORT}`);
    });
});
