var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');
var { v4: uuidv4 } = require('uuid');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const knowledgeRouter = require('./routes/knowledge');
const chatRouter = require('./routes/chat');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Session management
app.use(session({
  secret: process.env.SESSION_SECRET || 'bitcoin-edu-roleplay-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.SESSION_SECURE_COOKIES === 'true' || process.env.NODE_ENV === 'production',
    httpOnly: process.env.SESSION_HTTP_ONLY !== 'false',
    sameSite: process.env.SESSION_SAME_SITE || (process.env.NODE_ENV === 'production' ? 'strict' : 'lax'),
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000 // 24 hours default
  },
  genid: function(req) {
    return uuidv4(); // Generate unique session ID
  }
}));

// Initialize user session if not exists
app.use((req, res, next) => {
  if (!req.session.userId) {
    req.session.userId = uuidv4();
    req.session.createdAt = Date.now();
    console.log(`New user session created: ${req.session.userId}`);
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Environment endpoint for frontend to check if we're in dev mode
app.get('/api/environment', (req, res) => {
  res.json({ environment: process.env.NODE_ENV || 'development' });
});

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/knowledge', knowledgeRouter);
app.use('/chat', chatRouter);

module.exports = app;
