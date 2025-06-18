const request = require('supertest');
const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const router = require('../src/routes/auth');
const User = require('../src/models/User');

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../src/models/User');

const mockUser = {
  _id: '123',
  email: 'test@example.com',
  oauthProvider: 'google',
  oauthId: 'google123',
  profile: { name: 'Test User', avatar: 'http://avatar.url' },
  lastLoginAt: new Date('2025-06-18T10:28:20.079Z').toISOString(), // Match Mongoose serialization
  isActive: true,
};

describe('Auth Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', router);

    // Reset mocks
    jest.clearAllMocks();

    // Mock environment variables (as fallback)
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
    process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'mock-client-id';
    process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'mock-client-secret';
    process.env.GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'mock-github-id';
    process.env.GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || 'mock-github-secret';
  });

  describe('GET /api/auth/google', () => {
    it('should initiate Google OAuth flow', async () => {
      const response = await request(app).get('/api/auth/google');
      expect(response.status).toBe(200);
      expect(response.text).toBe('Redirecting to google');
      expect(passport.authenticate).toHaveBeenCalledWith('google', { scope: ['profile', 'email'] });
    });
  });

  describe('GET /api/auth/google/callback', () => {
    it('should handle successful Google OAuth callback and redirect with token', async () => {
      jwt.sign.mockReturnValue('mockJwtToken');

      const response = await request(app).get('/api/auth/google/callback');
      expect(response.status).toBe(302);
      expect(response.header.location).toBe('http://localhost:3000/auth/callback?token=mockJwtToken');
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: mockUser._id, email: mockUser.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      expect(passport.authenticate).toHaveBeenCalledWith('google', { session: false });
    });
  });

  describe('POST /api/auth/verify-token', () => {
    it('should verify a valid token and return user data', async () => {
      jwt.verify.mockReturnValue({ userId: mockUser._id, email: mockUser.email });
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const response = await request(app)
        .post('/api/auth/verify-token')
        .send({ token: 'mockJwtToken' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ user: mockUser, token: 'mockJwtToken' });
      expect(jwt.verify).toHaveBeenCalledWith('mockJwtToken', process.env.JWT_SECRET);
      expect(User.findById).toHaveBeenCalledWith(mockUser._id);
    });

    it('should return 401 for invalid token', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const response = await request(app)
        .post('/api/auth/verify-token')
        .send({ token: 'invalidToken' });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Invalid token' });
    });

    it('should return 401 for inactive user', async () => {
      jwt.verify.mockReturnValue({ userId: mockUser._id, email: mockUser.email });
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({ ...mockUser, isActive: false }),
      });

      const response = await request(app)
        .post('/api/auth/verify-token')
        .send({ token: 'mockJwtToken' });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Invalid user' });
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should confirm logout', async () => {
      const response = await request(app).post('/api/auth/logout');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Logged out successfully' });
    });
  });
});