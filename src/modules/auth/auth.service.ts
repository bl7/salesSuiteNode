import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { pool } from '../../db/pool';
import { LoginInput, SignupCompanyInput, ForgotPasswordInput, ResetPasswordInput } from './auth.schema';
import { userRepository } from '../users/users.repository';
import { companyRepository } from '../companies/companies.repository';
import { companyUserRepository } from '../companies/company-users.repository';
import { emailTokenRepository } from './email-tokens.repository';
import { emailService } from '../../services/email.service';

export class AuthService {
  async signupCompany(input: SignupCompanyInput) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Create Company
      const company = await companyRepository.create({
        name: input.companyName,
        slug: input.companySlug,
        address: input.address,
      }, client);

      // 2. Create User (or get existing - implementing create for simplicity now, assuming unique email constraint handles duplicate)
      // Check if user exists first to handle robustly?
      let user = await userRepository.findByEmail(input.email, client);
      if (!user) {
        const hashedPassword = await bcrypt.hash(input.password, 10);
        user = await userRepository.create({
          email: input.email,
          fullName: input.fullName,
          passwordHash: hashedPassword,
        }, client);
      }

      // 3. Link User to Company
      const companyUser = await companyUserRepository.create(
        company.id,
        user.id,
        input.role,
        'invited',
        input.phone,
        client
      );

      // 4. Create Email Token
      const token = randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      await emailTokenRepository.create({
        token,
        userId: user.id,
        tokenType: 'email_verify',
        expiresAt
      }, client);

      // 5. Send Email (Side effect, can be outside transaction or swallowed on error?)
      // We'll await it to ensure it sends, or just log error if fail
      await emailService.sendVerificationEmail(input.email, input.fullName, token);

      await client.query('COMMIT');

      return {
        ok: true,
        company: {
          id: company.id,
          name: company.name,
          slug: company.slug
        },
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: companyUser.role,
          companyUserId: companyUser.id
        }
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async login(input: LoginInput) {
    const user = await userRepository.findByEmail(input.email);
    if (!user) return null;

    const isValid = await bcrypt.compare(input.password, user.password_hash);
    if (!isValid) return null;

    // Get Company details
    const companyUser = await companyUserRepository.findByUserId(user.id);
    if (!companyUser) {
        // User exists but has no company? Edge case.
        return null; 
    }

    const company = await companyRepository.findById(companyUser.company_id);
    if (!company) return null;

    // Update last login
    await userRepository.updateLastLogin(user.id);

    return {
      ok: true,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        phone: companyUser.phone,
        role: companyUser.role,
        companyUserId: companyUser.id,
        status: companyUser.status
      },
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        address: company.address,
        plan: company.plan,
        subscriptionEndsAt: company.subscription_ends_at ? company.subscription_ends_at.toISOString() : null,
        staffLimit: company.staff_limit,
        staffCount: company.staff_count || 0
      }
    };
  }
  
  async forgotPassword(input: ForgotPasswordInput) {
      const user = await userRepository.findByEmail(input.email);
      if (user) {
          const token = randomUUID();
          const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
          await emailTokenRepository.create({ token, userId: user.id, tokenType: 'password_reset', expiresAt });
          await emailService.sendPasswordResetEmail(user.email, token);
      }
      return { ok: true, message: "If an account with that email exists, a reset link has been sent." };
  }

  async resetPassword(input: ResetPasswordInput) {
      const tokenRecord = await emailTokenRepository.findById(input.token);
      if (!tokenRecord || tokenRecord.expires_at < new Date() || tokenRecord.token_type !== 'password_reset') {
          throw new Error('Invalid or expired token');
      }

      const client = await pool.connect();
      try {
          await client.query('BEGIN');
          const hashedPassword = await bcrypt.hash(input.password, 10);
          
          // Manually update password - moving to Repository would be cleaner but direct query is fine for now
           await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, tokenRecord.user_id]);
           await emailTokenRepository.delete(input.token, client);
           
           await client.query('COMMIT');
           return { ok: true, message: "Password has been reset. You can now log in." };
      } catch (e) {
          await client.query('ROLLBACK');
          throw e;
      } finally {
          client.release();
      }
  }

  async verifyEmail(token: string) {
      const tokenRecord = await emailTokenRepository.findById(token);
      if (!tokenRecord || tokenRecord.expires_at < new Date() || tokenRecord.token_type !== 'email_verify') {
          throw new Error('Invalid or expired token');
      }

       const client = await pool.connect();
      try {
          await client.query('BEGIN');
          // Update User
          await client.query('UPDATE users SET email_verified_at = NOW() WHERE id = $1', [tokenRecord.user_id]);
          // Update Company User Status
          await client.query(`UPDATE company_users SET status = 'active' WHERE user_id = $1`, [tokenRecord.user_id]);
          
          await emailTokenRepository.delete(token, client);
           await client.query('COMMIT');
      } catch (e) {
          await client.query('ROLLBACK');
          throw e;
      } finally {
          client.release();
      }
  }
  async getContext(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) return null;

    const companyUser = await companyUserRepository.findByUserId(user.id);
    if (!companyUser) return null;

    const company = await companyRepository.findById(companyUser.company_id);
    if (!company) return null;

    return {
      ok: true,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        phone: companyUser.phone,
        role: companyUser.role,
        companyUserId: companyUser.id,
        status: companyUser.status
      },
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        address: company.address,
        plan: company.plan,
        subscriptionEndsAt: company.subscription_ends_at ? company.subscription_ends_at.toISOString() : null,
        staffLimit: company.staff_limit,
        staffCount: company.staff_count || 0
      }
    };
  }
}

export const authService = new AuthService();
