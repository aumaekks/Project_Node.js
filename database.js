const mysql = require('mysql2');
const dbConnection = mysql.createPool({
    host     : 'localhost', // MYSQL HOST NAME
    user     : 'root', // MYSQL USERNAME
    password : 'sarawut004735', // MYSQL PASSWORD
    database : 'fitness' // MYSQL DB NAME
}).promise();
module.exports = dbConnection;