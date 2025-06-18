// tests/setup.js
require('dotenv').config(); // Load .env file

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const passport = require('passport');

// Mock dependencies
jest.mock('passport');
jest.mock('passport-google-oauth20');
jest.mock('passport-github2');

// Mock passport.authenticate
jest.spyOn(passport, 'authenticate').mockImplementation((strategy, options) => {
  return (req, res, next) => {
    if (strategy === 'google' && options.scope) {
      res.status(200).send(`Redirecting to ${strategy}`);
    } else if (strategy === 'google' && options.session === false) {
      req.user = {
        _id: '123',
        email: 'test@example.com',
        oauthProvider: 'google',
        oauthId: 'google123',
        oauthToken: 'mockAccessToken',
        refreshToken: 'mockRefreshToken',
        profile: { name: 'Test User', avatar: 'http://avatar.url' },
        lastLoginAt: new Date('2025-06-18T10:28:20.079Z').toISOString(),
        isActive: true,
      };
      next();
    } else {
      next(new Error('Invalid strategy or options'));
    }
  };
});

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});