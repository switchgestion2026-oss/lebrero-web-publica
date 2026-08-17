require('dotenv').config();
console.log('DEBUG DATABASE_URL cargada:', process.env.DATABASE_URL ? 'SI, longitud=' + process.env.DATABASE_URL.length : 'NO, esta undefined');
const express = require('express');
const cors = require('cors');

const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.json({ status: 'ok', service: 'lebrero-web-publica' }));

app.use('/public', publicRoutes);
app.use('/api/public', publicRoutes);
app.use('/admin', adminRoutes);
app.use('/api', adminRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
