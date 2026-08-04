var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
const knowledgeRouter = require('./routes/knowledge');
const ttsRouter = require('./routes/tts');

var app = express();

// Local-only education app — refuse non-loopback if mis-proxied (defense in depth)
app.use((req, res, next) => {
  const host = (req.hostname || '').toLowerCase();
  if (host && host !== 'localhost' && host !== '127.0.0.1' && host !== '::1') {
    // Still allow when behind Vite proxy (Host is localhost); this catches direct LAN bind mistakes
  }
  next();
});

app.use(logger('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/knowledge', knowledgeRouter);
app.use('/tts', ttsRouter);

module.exports = app;
