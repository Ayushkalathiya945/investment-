import { describe, it, expect, beforeAll } from 'vitest';
import { createServer } from 'node:http';
import request from 'supertest';
import api from '../index';
import { testDb } from './setup';
import { admins } from '../db/schema';
import bcrypt from 'bcrypt';

// Create a server for testing
const server = createServer({
  port: 0, // Use any available port
  fetch: api.fetch,
});

describe('Authentication API', () => {
  beforeAll(async () => {
    // Ensure we have a test admin user with known credentials
    await testDb.delete(admins);
    const hashedPassword = await bcrypt.hash('testpassword', 10);
    await testDb.insert(admins).values({
      username: 'testadmin',
      password: hashedPassword,
      email: 'testadmin@investasure.com',
    });
  });

  it('should return 401 for invalid credentials', async () => {
    const response = await request(server)
      .post('/auth/login')
      .send({
        username: 'testadmin',
        password: 'wrongpassword',
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('Invalid credentials');
  });

  it('should login successfully with valid credentials', async () => {
    const response = await request(server)
      .post('/auth/login')
      .send({
        username: 'testadmin',
        password: 'testpassword',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('token');
    expect(response.body.data).toHaveProperty('admin');
    expect(response.body.data.admin.username).toBe('testadmin');
    expect(response.body.data.admin).not.toHaveProperty('password');
  });

  it('should reject requests to protected routes without token', async () => {
    const response = await request(server).get('/clients');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('Unauthorized');
  });

  it('should accept requests to protected routes with valid token', async () => {
    // First login to get a token
    const loginResponse = await request(server)
      .post('/auth/login')
      .send({
        username: 'testadmin',
        password: 'testpassword',
      });

    const token = loginResponse.body.data.token;

    // Now use that token to access a protected route
    const response = await request(server)
      .get('/clients')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
