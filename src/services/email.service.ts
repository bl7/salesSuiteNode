import nodemailer from 'nodemailer';
import { env } from '../config/env';

// Configure transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASS, 
  },
});

export const emailService = {
  async sendEmail(to: string, subject: string, text: string, html?: string) {
    try {
      const info = await transporter.sendMail({
        from: `"${process.env.COMPANY_NAME || 'SalesSuite'}" <${process.env.GMAIL_USER}>`,
        to,
        subject,
        text,
        html: html || text,
      });
      console.log('Message sent: %s', info.messageId);
    } catch (error) {
      console.error('Error sending email:', error);
      // Don't throw, just log. In prod we might want to retry or queue.
    }
  },

  async sendVerificationEmail(email: string, fullName: string, token: string) {
    const backendUrl = process.env.BACKEND_URL || 'https://renderlabels.instalabel.co';
    const verifyUrl = `${backendUrl}/api/auth/verify-email?token=${token}`;
    const subject = 'Verify your SalesSuite account';
    const text = `Hi ${fullName},\n\nPlease verify your email by clicking the link below:\n\n${verifyUrl}\n\nThis link expires in 24 hours.\n\n— SalesSuite`;
    const html = `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>Hi ${fullName},</h2>
        <p>Please verify your email by clicking the link below:</p>
        <a href="${verifyUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a>
        <p>Or click: <a href="${verifyUrl}">${verifyUrl}</a></p>
        <p>This link expires in 24 hours.</p>
        <p>— SalesSuite</p>
      </div>
    `;
    await this.sendEmail(email, subject, text, html);
  },

  async sendPasswordResetEmail(email: string, token: string) {
    // Note: In a real app this should link to a frontend page that takes the token.
    // For now assuming API direct or frontend route wrapper.
    const resetUrl = `https://kora-sand.vercel.app/auth/reset-password?token=${token}`;
    const subject = 'Reset your SalesSuite password';
    const text = `Hi,\n\nYou requested a password reset. Click the link below:\n\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.\n\n— SalesSuite`;
    const html = `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>Password Reset Request</h2>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
        <p>Or click: <a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link expires in 1 hour.</p>
        <p>— SalesSuite</p>
      </div>
    `;
    await this.sendEmail(email, subject, text, html);
  },

  async sendStaffInvitation(email: string, fullName: string, companyName: string, passwordDetails: string, loginUrl: string) {
    const subject = `You've been added to ${companyName} on SalesSuite`;
    const prodLoginUrl = `https://kora-sand.vercel.app/auth/login`;
    const text = `Hi ${fullName},\n\nYou've been added as a team member at ${companyName} on SalesSuite.\n\nYour login credentials:\nEmail: ${email}\nPassword: ${passwordDetails}\n\nLog in at: ${prodLoginUrl}\n\nPlease change your password after your first login.\n\n— SalesSuite`;
    const html = `
       <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2>Hi ${fullName},</h2>
        <p>You've been added as a team member at <strong>${companyName}</strong> on SalesSuite.</p>
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Password:</strong> <code>${passwordDetails}</code></p>
        </div>
        <a href="${prodLoginUrl}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Log In Now</a>
        <p>Please change your password after your first login.</p>
        <p>— SalesSuite</p>
      </div>
    `;
    await this.sendEmail(email, subject, text, html);
  },
  
  async sendContactFormNotification(data: { name: string; company: string; email: string; phone: string; teamSize: string; message: string }) {
      const subject = `New demo request from ${data.name} at ${data.company}`;
      const text = `New demo request:\n\nName: ${data.name}\nCompany: ${data.company}\nEmail: ${data.email}\nPhone: ${data.phone}\nTeam Size: ${data.teamSize}\n\nMessage:\n${data.message}\n\n— SalesSuite Demo Request`;
      const html = `
         <div style="font-family: sans-serif; padding: 20px;">
          <h2>New Demo Request</h2>
          <ul>
            <li><strong>Name:</strong> ${data.name}</li>
            <li><strong>Company:</strong> ${data.company}</li>
            <li><strong>Email:</strong> ${data.email}</li>
            <li><strong>Phone:</strong> ${data.phone}</li>
            <li><strong>Team Size:</strong> ${data.teamSize}</li>
          </ul>
          <h3>Message:</h3>
          <p>${data.message.replace(/\n/g, '<br>')}</p>
        </div>
      `;
      // Send to admin email (configure in env)
      const adminEmail = process.env.ADMIN_EMAIL || process.env.GMAIL_USER;
      if (adminEmail) {
         await this.sendEmail(adminEmail, subject, text, html);
      }
  },

  async sendContactFormConfirmation(name: string, email: string) {
      const subject = "We've received your message";
      const text = `Hi ${name},\n\nThank you for reaching out to SalesSuite. We've received your message and will get back to you as soon as possible.\n\n— SalesSuite Team`;
      const html = `
        <div style="font-family: sans-serif; padding: 20px;">
           <h2>Hi ${name},</h2>
           <p>Thank you for reaching out to SalesSuite. We've received your message and will get back to you as soon as possible.</p>
           <p>— SalesSuite Team</p>
        </div>
      `;
      await this.sendEmail(email, subject, text, html);
  }
};
