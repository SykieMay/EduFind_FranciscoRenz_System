const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));

// Database Connection
const dbHost = process.env.DB_HOST;
const shouldUseSsl = process.env.DB_SSL === 'true' || dbHost?.includes('aivencloud.com');

const db = mysql.createConnection({
    host: dbHost,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
    connectTimeout: 10000,
    ...(shouldUseSsl ? { ssl: { rejectUnauthorized: false } } : {})
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Middleware for JWT Authentication
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const canManage = (user) => user && (user.role === 'admin' || user.role === 'staff');
const dbp = db.promise();

app.get('/api/health', (req, res) => {
    res.json({ ok: true, service: 'edufind' });
});

// Helper to log transactions
const logTransaction = (itemId, userId, type, description) => {
    const query = 'INSERT INTO transactions (itemId, userId, type, description) VALUES (?, ?, ?, ?)';
    db.query(query, [itemId, userId, type, description], (err) => {
        if (err) console.error('Error logging transaction:', err);
    });
};

const withForeignKeyChecksOff = async (work) => {
    try {
        await dbp.query('SET FOREIGN_KEY_CHECKS = 0');
        await work();
    } finally {
        await dbp.query('SET FOREIGN_KEY_CHECKS = 1');
    }
};

const renumberUsers = async () => {
    const [rows] = await dbp.query('SELECT id FROM users ORDER BY id');
    const mappings = rows.map((row, index) => ({ oldId: row.id, newId: index + 1 }));

    await withForeignKeyChecksOff(async () => {
        for (const { oldId, newId } of mappings) {
            if (oldId === newId) continue;

            await dbp.query('UPDATE items SET reporterId = ? WHERE reporterId = ?', [newId, oldId]);
            await dbp.query('UPDATE claims SET claimerId = ? WHERE claimerId = ?', [newId, oldId]);
            await dbp.query('UPDATE messages SET senderId = ? WHERE senderId = ?', [newId, oldId]);
            await dbp.query('UPDATE messages SET receiverId = ? WHERE receiverId = ?', [newId, oldId]);
            await dbp.query('UPDATE notifications SET userId = ? WHERE userId = ?', [newId, oldId]);
            await dbp.query('UPDATE transactions SET userId = ? WHERE userId = ?', [newId, oldId]);
            await dbp.query('UPDATE users SET id = ? WHERE id = ?', [newId, oldId]);
        }

        await dbp.query(`ALTER TABLE users AUTO_INCREMENT = ${rows.length + 1}`);
    });
};

const renumberItems = async () => {
    const [rows] = await dbp.query('SELECT id FROM items ORDER BY id');
    const mappings = rows.map((row, index) => ({ oldId: row.id, newId: index + 1 }));

    await withForeignKeyChecksOff(async () => {
        for (const { oldId, newId } of mappings) {
            if (oldId === newId) continue;

            await dbp.query('UPDATE claims SET itemId = ? WHERE itemId = ?', [newId, oldId]);
            await dbp.query('UPDATE notifications SET itemId = ? WHERE itemId = ?', [newId, oldId]);
            await dbp.query('UPDATE transactions SET itemId = ? WHERE itemId = ?', [newId, oldId]);
            await dbp.query('UPDATE items SET id = ? WHERE id = ?', [newId, oldId]);
        }

        await dbp.query(`ALTER TABLE items AUTO_INCREMENT = ${rows.length + 1}`);
    });
};

const renumberSimpleTable = async (tableName) => {
    const allowedTables = new Set(['claims', 'messages', 'notifications', 'transactions']);
    if (!allowedTables.has(tableName)) throw new Error('Invalid table for renumbering');

    const [rows] = await dbp.query(`SELECT id FROM ${tableName} ORDER BY id`);
    const mappings = rows.map((row, index) => ({ oldId: row.id, newId: index + 1 }));

    await withForeignKeyChecksOff(async () => {
        for (const { oldId, newId } of mappings) {
            if (oldId === newId) continue;
            await dbp.query(`UPDATE ${tableName} SET id = ? WHERE id = ?`, [newId, oldId]);
        }

        await dbp.query(`ALTER TABLE ${tableName} AUTO_INCREMENT = ${rows.length + 1}`);
    });
};

// --- Auth Routes ---
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(401).json({ error: 'User not found' });

        const user = results[0];
        if (password !== user.password) return res.status(401).json({ error: 'Invalid password' });

        const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET);
        res.json({
            token,
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                middleInitial: user.middleInitial,
                role: user.role,
                email: user.email,
                department: user.department,
                studentId: user.studentId,
                staffId: user.staffId,
                rating: user.rating,
                ratingCount: user.ratingCount,
                warnings: user.warnings,
                profilePicture: user.profilePicture
            }
        });
    });
});

app.post('/api/forgot-password', (req, res) => {
    const { email, institutionId, newPassword } = req.body;

    if (!email || !institutionId || !newPassword) {
        return res.status(400).json({ error: 'Email, institution ID, and new password are required' });
    }

    db.query(
        'SELECT id FROM users WHERE email = ? AND (studentId = ? OR staffId = ?)',
        [email, institutionId, institutionId],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            if (results.length === 0) return res.status(404).json({ error: 'No matching account found' });

            db.query(
                'UPDATE users SET password = ? WHERE id = ?',
                [newPassword, results[0].id],
                (updateErr) => {
                    if (updateErr) return res.status(500).json({ error: updateErr.message });
                    res.json({ message: 'Password reset successfully' });
                }
            );
        }
    );
});

// --- User Routes ---
app.get('/api/users/me', authenticateToken, (req, res) => {
    db.query('SELECT * FROM users WHERE id = ?', [req.user.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results[0]);
    });
});

app.post('/api/users', authenticateToken, (req, res) => {
    if (!canManage(req.user)) {
        return res.status(403).json({ error: 'Only staff or admins can register users' });
    }

    const {
        firstName,
        lastName,
        middleInitial,
        email,
        password,
        role,
        department,
        studentId,
        staffId
    } = req.body;

    const normalizedRole = role || 'student';

    if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ error: 'First name, last name, email, and password are required' });
    }

    if (!['admin', 'staff', 'student'].includes(normalizedRole)) {
        return res.status(400).json({ error: 'Invalid user role' });
    }

    if (req.user.role === 'staff' && normalizedRole !== 'student') {
        return res.status(403).json({ error: 'Staff can only register student accounts' });
    }

    const query = `
        INSERT INTO users
        (firstName, lastName, middleInitial, email, password, role, department, studentId, staffId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
        query,
        [
            firstName,
            lastName,
            middleInitial,
            email,
            password,
            normalizedRole,
            department,
            studentId,
            staffId
        ],
        (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({
                    error: err.message
                });
            }

            db.query(
                'SELECT id, firstName, lastName, middleInitial, email, role, department, studentId, staffId, rating, ratingCount, warnings, profilePicture FROM users WHERE id = ?',
                [result.insertId],
                (selectErr, results) => {
                    if (selectErr) return res.status(500).json({ error: selectErr.message });
                    res.status(201).json({ success: true, user: results[0] });
                }
            );
        }
    );
});

app.get('/api/users', authenticateToken, (req, res) => {
    db.query('SELECT id, firstName, lastName, middleInitial, email, role, department, studentId, staffId, rating, ratingCount, warnings, profilePicture FROM users', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.put('/api/users/me', authenticateToken, (req, res) => {
    const { firstName, middleInitial, lastName, email, department, profilePicture } = req.body;

    if (!firstName || !lastName || !email) {
        return res.status(400).json({ error: 'First name, last name, and email are required' });
    }

    db.query(
        'UPDATE users SET firstName = ?, middleInitial = ?, lastName = ?, email = ?, department = ?, profilePicture = COALESCE(?, profilePicture) WHERE id = ?',
        [firstName, middleInitial || null, lastName, email, department || null, profilePicture ?? null, req.user.id],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            db.query('SELECT * FROM users WHERE id = ?', [req.user.id], (selectErr, results) => {
                if (selectErr) return res.status(500).json({ error: selectErr.message });
                res.json(results[0]);
            });
        }
    );
});

app.put('/api/users/me/password', authenticateToken, (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
    }

    db.query('SELECT password FROM users WHERE id = ?', [req.user.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: 'User not found' });
        if (results[0].password !== currentPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        db.query('UPDATE users SET password = ? WHERE id = ?', [newPassword, req.user.id], (updateErr) => {
            if (updateErr) return res.status(500).json({ error: updateErr.message });
            res.json({ message: 'Password changed successfully' });
        });
    });
});

app.put('/api/users/:id', authenticateToken, (req, res) => {
    if (!canManage(req.user)) {
        return res.status(403).json({ error: 'Only staff or admins can update users' });
    }

    const { firstName, middleInitial, lastName, email, department } = req.body;
    if (!firstName || !lastName || !email) {
        return res.status(400).json({ error: 'First name, last name, and email are required' });
    }

    const ownershipClause = req.user.role === 'staff' ? ' AND role = "student"' : '';
    db.query(
        `UPDATE users SET firstName = ?, middleInitial = ?, lastName = ?, email = ?, department = ? WHERE id = ?${ownershipClause}`,
        [firstName, middleInitial || null, lastName, email, department || null, req.params.id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found or not allowed' });
            res.json({ message: 'User updated' });
        }
    );
});

app.delete('/api/users/:id', authenticateToken, (req, res) => {
    if (!canManage(req.user)) {
        return res.status(403).json({ error: 'Only staff or admins can delete users' });
    }
    if (Number(req.params.id) === req.user.id) {
        return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    const ownershipClause = req.user.role === 'staff' ? ' AND role = "student"' : '';
    db.query(`DELETE FROM users WHERE id = ?${ownershipClause}`, [req.params.id], async (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found or not allowed' });
        try {
            await renumberUsers();
            res.json({ message: 'User deleted' });
        } catch (renumberErr) {
            console.error(renumberErr);
            res.status(500).json({ error: renumberErr.message });
        }
    });
});

// --- Item Routes ---
app.get('/api/items', authenticateToken, (req, res) => {
    db.query('SELECT i.*, u.firstName as reporterFirstName, u.lastName as reporterLastName FROM items i LEFT JOIN users u ON i.reporterId = u.id ORDER BY i.createdAt DESC', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/items', authenticateToken, (req, res) => {
    const { title, description, type, status, date, category, image, verificationQuestion, verificationAnswer } = req.body;
    if (!title || !type || !date) {
        return res.status(400).json({ error: 'Title, type, and date are required' });
    }
    if (image && image.length > 750000) {
        return res.status(413).json({ error: 'Image is too large. Please upload a smaller photo.' });
    }
    const query = 'INSERT INTO items (title, description, type, status, date, category, image, verificationQuestion, verificationAnswer, reporterId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    db.query(query, [title, description, type, status || 'pending', date, category, image, verificationQuestion, verificationAnswer, req.user.id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        const itemId = result.insertId;
        logTransaction(itemId, req.user.id, 'report', `Reported a ${type} item: ${title}`);
        res.json({ success: true, id: itemId, message: 'Item reported successfully' });
    });
});

app.put('/api/items/:id/status', authenticateToken, (req, res) => {
    const { status } = req.body;
    const allowedStatuses = ['pending', 'reported', 'claimed', 'found'];

    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid item status' });
    }

    db.query('UPDATE items SET status = ? WHERE id = ?', [status, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });

        const finish = () => {
            logTransaction(req.params.id, req.user.id, 'status_change', `Changed status to ${status}`);
            res.json({ message: 'Status updated' });
        };

        if (status !== 'claimed') {
            finish();
            return;
        }

        db.query(
            "UPDATE claims SET status = 'approved' WHERE itemId = ? AND status = 'pending'",
            [req.params.id],
            (claimErr) => {
                if (claimErr) return res.status(500).json({ error: claimErr.message });
                finish();
            }
        );
    });
});

app.put('/api/items/:id', authenticateToken, (req, res) => {
    const { title, description, category } = req.body;

    if (!title || !description || !category) {
        return res.status(400).json({ error: 'Title, description, and category are required' });
    }

    db.query(
        "UPDATE items SET title = ?, description = ?, category = ? WHERE id = ? AND (reporterId = ? OR ? IN ('admin', 'staff'))",
        [title, description, category, req.params.id, req.user.id, req.user.role],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) return res.status(404).json({ error: 'Item not found or not allowed' });
            res.json({ message: 'Item updated' });
        }
    );
});

app.delete('/api/items/:id', authenticateToken, (req, res) => {
    db.query(
        "DELETE FROM items WHERE id = ? AND (reporterId = ? OR ? IN ('admin', 'staff'))",
        [req.params.id, req.user.id, req.user.role],
        async (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) return res.status(404).json({ error: 'Item not found or not allowed' });
            try {
                await renumberItems();
                await renumberSimpleTable('claims');
                await renumberSimpleTable('notifications');
                res.json({ message: 'Item deleted' });
            } catch (renumberErr) {
                console.error(renumberErr);
                res.status(500).json({ error: renumberErr.message });
            }
        }
    );
});

// --- Claim Routes ---
app.post('/api/claims', authenticateToken, (req, res) => {
    const { itemId, verificationAnswer } = req.body;
    const query = 'INSERT INTO claims (itemId, claimerId, verificationAnswer, status, timestamp) VALUES (?, ?, ?, ?, ?)';
    db.query(query, [itemId, req.user.id, verificationAnswer, 'pending', Date.now()], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        logTransaction(itemId, req.user.id, 'claim', 'Submitted a claim request');
        res.json({ id: result.insertId, message: 'Claim submitted' });
    });
});

app.get('/api/claims', authenticateToken, (req, res) => {
    db.query(
        "UPDATE claims c JOIN items i ON c.itemId = i.id SET c.status = 'approved' WHERE c.status = 'pending' AND i.status = 'claimed'",
        (syncErr) => {
            if (syncErr) return res.status(500).json({ error: syncErr.message });

            db.query(`
                SELECT c.*, i.title as itemTitle, i.reporterId, i.status as itemStatus, u.firstName as claimerFirstName, u.lastName as claimerLastName,
                       u.role as claimerRole, u.studentId as claimerStudentId, u.staffId as claimerStaffId
                FROM claims c
                JOIN items i ON c.itemId = i.id
                JOIN users u ON c.claimerId = u.id
            `, (err, results) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json(results);
            });
        }
    );
});

app.put('/api/claims/:id/status', authenticateToken, (req, res) => {
    const { status } = req.body;
    const allowedStatuses = ['pending', 'approved', 'rejected'];

    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid claim status' });
    }

    db.query(
        "UPDATE claims c JOIN items i ON c.itemId = i.id SET c.status = ?, i.status = CASE WHEN ? = 'approved' THEN 'claimed' ELSE i.status END WHERE c.id = ? AND (i.reporterId = ? OR ? IN ('admin', 'staff'))",
        [status, status, req.params.id, req.user.id, req.user.role],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) return res.status(404).json({ error: 'Claim not found or not allowed' });
            res.json({ message: 'Claim status updated' });
        }
    );
});

// --- Transaction History Route ---
app.get('/api/transactions', authenticateToken, (req, res) => {
    let query = 'SELECT t.*, i.title as itemTitle, u.firstName, u.lastName FROM transactions t LEFT JOIN items i ON t.itemId = i.id LEFT JOIN users u ON t.userId = u.id';
    const params = [];
    
    if (req.user.role !== 'admin' && req.user.role !== 'staff') {
        query += ' WHERE t.userId = ?';
        params.push(req.user.id);
    }
    
    query += ' ORDER BY t.timestamp DESC';
    
    db.query(query, params, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// --- Message Routes ---
app.get('/api/messages', authenticateToken, (req, res) => {
    db.query(
        `SELECT id, senderId, receiverId, text, timestamp, \`read\`
         FROM messages
         WHERE senderId = ? OR receiverId = ?
         ORDER BY timestamp ASC`,
        [req.user.id, req.user.id],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(results);
        }
    );
});

app.post('/api/messages', authenticateToken, (req, res) => {
    const { receiverId, text } = req.body;

    if (!receiverId || !text || !String(text).trim()) {
        return res.status(400).json({ error: 'Receiver and message text are required' });
    }

    const timestamp = Date.now();
    db.query(
        'INSERT INTO messages (senderId, receiverId, text, timestamp, `read`) VALUES (?, ?, ?, ?, FALSE)',
        [req.user.id, receiverId, String(text).trim(), timestamp],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({
                id: result.insertId,
                senderId: req.user.id,
                receiverId,
                text: String(text).trim(),
                timestamp,
                read: false
            });
        }
    );
});

app.put('/api/messages/read/:senderId', authenticateToken, (req, res) => {
    db.query(
        'UPDATE messages SET `read` = TRUE WHERE receiverId = ? AND senderId = ?',
        [req.user.id, req.params.senderId],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Messages marked as read' });
        }
    );
});

// --- Notification Routes ---
app.get('/api/notifications', authenticateToken, (req, res) => {
    db.query('SELECT * FROM notifications WHERE userId = ? ORDER BY timestamp DESC', [req.user.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/notifications', authenticateToken, (req, res) => {
    const { userId, itemId, type, title, message } = req.body;
    const query = 'INSERT INTO notifications (userId, itemId, type, title, message, timestamp) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(query, [userId, itemId, type, title, message, Date.now()], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Notification sent' });
    });
});

app.put('/api/notifications/read', authenticateToken, (req, res) => {
    db.query('UPDATE notifications SET `read` = TRUE WHERE userId = ?', [req.user.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Notifications marked as read' });
    });
});

app.delete('/api/notifications', authenticateToken, (req, res) => {
    db.query('DELETE FROM notifications WHERE userId = ?', [req.user.id], async (err) => {
        if (err) return res.status(500).json({ error: err.message });
        try {
            await renumberSimpleTable('notifications');
            res.json({ message: 'Notifications cleared' });
        } catch (renumberErr) {
            console.error(renumberErr);
            res.status(500).json({ error: renumberErr.message });
        }
    });
});

app.post('/api/admin/renumber-ids', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can renumber database IDs' });
    }

    try {
        await renumberUsers();
        await renumberItems();
        await renumberSimpleTable('claims');
        await renumberSimpleTable('messages');
        await renumberSimpleTable('notifications');
        await renumberSimpleTable('transactions');
        res.json({ message: 'Database IDs renumbered successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// --- Static Files ---
app.get('/reports', authenticateToken, (req, res) => {
    db.query(
        'SELECT id as report_id, title as item_name, description, status, date as date_reported FROM items ORDER BY createdAt DESC',
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(results);
        }
    );
});

app.use(express.static(__dirname));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
