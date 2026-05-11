CREATE DATABASE IF NOT EXISTS edufind_db;
USE edufind_db;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    firstName VARCHAR(50) NOT NULL,
    lastName VARCHAR(50) NOT NULL,
    middleInitial VARCHAR(5),
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'staff', 'student') DEFAULT 'student',
    studentId VARCHAR(20),
    staffId VARCHAR(20),
    department VARCHAR(100),
    rating FLOAT DEFAULT 5,
    ratingCount INT DEFAULT 0,
    warnings INT DEFAULT 0,
    profilePicture LONGTEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type ENUM('lost', 'found') NOT NULL,
    status ENUM('pending', 'reported', 'claimed', 'found') DEFAULT 'pending',
    date DATE NOT NULL,
    category VARCHAR(50),
    image LONGTEXT,
    verificationQuestion TEXT,
    verificationAnswer TEXT,
    reporterId INT,
    FOREIGN KEY (reporterId) REFERENCES users(id) ON DELETE SET NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS claims (
    id INT AUTO_INCREMENT PRIMARY KEY,
    itemId INT,
    claimerId INT,
    verificationAnswer TEXT,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    timestamp BIGINT,
    FOREIGN KEY (itemId) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (claimerId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    senderId INT,
    receiverId INT,
    text TEXT,
    timestamp BIGINT,
    `read` BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiverId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT,
    itemId INT,
    type VARCHAR(50),
    title VARCHAR(255),
    message TEXT,
    `read` BOOLEAN DEFAULT FALSE,
    timestamp BIGINT,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (itemId) REFERENCES items(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    itemId INT,
    userId INT,
    type ENUM('report', 'claim', 'recovery', 'status_change') NOT NULL,
    description TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (itemId) REFERENCES items(id) ON DELETE SET NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
);

-- Seed initial data
INSERT IGNORE INTO users (firstName, lastName, middleInitial, staffId, email, password, role) 
VALUES ('Admin', 'User', 'A', 'ADM001', 'admin@test.com', '123', 'admin');

INSERT IGNORE INTO users (firstName, lastName, middleInitial, staffId, email, password, role) 
VALUES ('Staff', 'Member', 'S', 'STF001', 'staff@test.com', '123', 'staff');

INSERT IGNORE INTO users (firstName, lastName, middleInitial, studentId, department, email, password, role) 
VALUES ('Student', 'User', 'J', 'STU001', 'Computer Science', 'student@test.com', '123', 'student');
