import NameGenerator from './nameGenerator.js';
import express from 'express';

const app = express()
const port = 3003

app.get('/', (req, res) => res.send('Hello World!'))
app.get('/random-name', (req, res) => res.send(NameGenerator.newName()))

app.listen(port, () => console.log(`name-generator listening on port ${port}!`))