import bcrypt from 'bcrypt';
import { pool } from '../../db/pool';
import { bossRepository } from './boss.repository';

export class BossService {
  async login(input: { email: string, password: string }) {
    const boss = await bossRepository.findByEmail(input.email);
    if (!boss) return null;

    const isValid = await bcrypt.compare(input.password, boss.password_hash);
    if (!isValid) return null;

    return {
      id: boss.id,
      fullName: boss.full_name,
      email: boss.email,
    };
  }

  async getBoss(id: string) {
      const boss = await bossRepository.findById(id);
      if (!boss) return null;

      return {
          id: boss.id,
          fullName: boss.full_name,
          email: boss.email,
      };
  }
}

export const bossService = new BossService();
