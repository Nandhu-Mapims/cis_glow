import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { config } from '../config/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { accessCheck } from '../services/accessCheck.js';
import { countRecentFailedLogins, insertLog } from '../services/logService.js';
import { decrypt, normalizeUsername } from '../services/password.js';
import { createSessionId, signToken } from '../utils/jwt.js';

const router = Router();

async function getInstitutionTimezone() {
  const setup = await prisma.basic_setup_tb.findFirst({ where: { del: 1 } });
  return setup?.time_zone || 'Asia/Kolkata';
}

function formatTimestamp(timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date()).replace(',', '').replace(/\//g, '-');
}

function buildUserProfile(user, sessionId) {
  const photoPath = user.photo ? `img/member/${user.photo}` : 'img/profile-avatar.jpg';
  return {
    id: user.id,
    memberId: user.member_id,
    memberName: user.member_name,
    email: user.address_email,
    accessType: user.access_type,
    photo: user.photo,
    photoUrl: `/legacy/${photoPath}`,
    resetPasswordRequired: Boolean(user.reset_password),
    sessionId,
  };
}

async function resolveFirstMenuLink(userId) {
  const rows = await prisma.$queryRaw`
    SELECT A.sub_menu_link
    FROM basic_admin_menu_tb AS A
    INNER JOIN admin_menu_category_tb AS B ON A.category_id = B.id
    INNER JOIN authentication_tb AS C ON A.id = C.menu_id
    WHERE A.del = 1 AND A.menu_enable = 1 AND B.del = 1 AND C.del = 1
      AND C.user_id = ${userId} AND C.authentication = 1
    ORDER BY B.category_order + 0 ASC, A.main_menu_order + 0 ASC
    LIMIT 1
  `;
  return rows[0]?.sub_menu_link || 'dashboard.php';
}

router.post('/login', async (req, res) => {
  try {
    const usernameInput = normalizeUsername(req.body.a_username || req.body.username);
    const passwordInput = String(req.body.a_password || req.body.password || '').trim();
    const userIp = req.ip || req.headers['x-forwarded-for'] || '';
    const userOs = req.headers['user-agent'] || '';
    const timeZone = await getInstitutionTimezone();
    const userDt = formatTimestamp(timeZone);

    const failedCount = await countRecentFailedLogins(String(userIp));
    if (failedCount >= 5) {
      await insertLog(['index', 'View', 'Successful', '', userDt, String(userIp), userOs, usernameInput]);
      return res.status(429).json({
        message: 'Your login has been temporarily disabled due to excessive login failures. Please try again in 5 minutes...',
      });
    }

    const user = await prisma.web_account_setup.findFirst({
      where: {
        del: 1,
        OR: [
          { member_id: usernameInput },
          { address_email: usernameInput },
        ],
      },
    });

    if (!user) {
      await insertLog(['index', 'login', 'Unsuccessful', '', userDt, String(userIp), userOs, usernameInput]);
      return res.status(401).json({ message: 'Wrong! Username or Password.' });
    }

    const decryptedPassword = decrypt(user.password).trim();
    const usernameMatches = usernameInput.toLowerCase() === user.member_id.toLowerCase()
      || usernameInput.toLowerCase() === user.address_email.toLowerCase();

    if (!decryptedPassword || !passwordInput || !usernameMatches || decryptedPassword !== passwordInput) {
      await insertLog(['index', 'login', 'Unsuccessful', '', userDt, String(userIp), userOs, user.member_id]);
      return res.status(401).json({ message: 'Wrong! Username or Password.' });
    }

    const sessionId = createSessionId();

    const accessResult = await accessCheck({
      userId: user.id,
      username: user.member_id,
      authType: user.access_type,
      userDt,
      userIp: String(userIp),
      userOs,
      cookies: req.cookies || {},
      sessionId,
    });

    if (!accessResult.success) {
      return res.status(403).json({ message: accessResult.message });
    }

    let redirectTo = 'dashboard.php';
    if (user.reset_password) {
      redirectTo = 'otp_request.php';
    } else if (user.access_type !== 'Global') {
      redirectTo = await resolveFirstMenuLink(user.id);
    }

    const token = signToken({
      id: user.id,
      memberId: user.member_id,
      memberName: user.member_name,
      accessType: user.access_type,
      sessionId,
    });

    const response = {
      token,
      user: buildUserProfile(user, sessionId),
      redirectTo,
    };

    if (accessResult.deviceCookies) {
      Object.entries(accessResult.deviceCookies).forEach(([name, value]) => {
        res.cookie(name, value, {
          maxAge: 365 * 24 * 60 * 60 * 1000,
          httpOnly: true,
          sameSite: 'lax',
        });
      });
    }

    return res.json(response);
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Login failed' });
  }
});

router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const timeZone = await getInstitutionTimezone();
    const userDt = formatTimestamp(timeZone);
    const userIp = req.ip || '';
    const userOs = req.headers['user-agent'] || '';

    await insertLog(['logout', 'logout', 'Successful', '', userDt, String(userIp), userOs, req.user.memberId], req.user.sessionId);
    return res.json({ message: 'Logged out' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ message: 'Logout failed' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.web_account_setup.findFirst({
      where: { id: req.user.id, del: 1 },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({ user: buildUserProfile(user, req.user.sessionId) });
  } catch (error) {
    console.error('Me error:', error);
    return res.status(500).json({ message: 'Unable to load profile' });
  }
});

export default router;
