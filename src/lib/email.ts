import nodemailer from 'nodemailer'

// Create reusable transporter
// For production, use real SMTP credentials from environment variables
// For development/testing, we'll use a test account or skip if not configured
const createTransporter = () => {
  // Check if email is configured
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log('Email not configured - SMTP_HOST or SMTP_USER missing')
    return null
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  })
}

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<boolean> {
  const transporter = createTransporter()

  if (!transporter) {
    console.log(`[Email] Would send to ${to}: ${subject}`)
    console.log(`[Email] Content preview: ${text || html.substring(0, 100)}...`)
    return true // Return true in dev mode without SMTP
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Padel PoC" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    })
    console.log(`[Email] Sent to ${to}: ${subject}`)
    return true
  } catch (error) {
    console.error('[Email] Failed to send:', error)
    return false
  }
}

// Welcome email for new registrations
export async function sendWelcomeEmail(email: string, name: string | null): Promise<boolean> {
  const displayName = name || 'Igraču'

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        h1 { margin: 0; }
        ul { padding-left: 20px; }
        li { margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎾 Padel PoC</h1>
        </div>
        <div class="content">
          <h2>Dobrodošao/la, ${displayName}!</h2>
          <p>Hvala ti na registraciji na <strong>Padel PoC</strong> platformu!</p>
          <p>Sada možeš:</p>
          <ul>
            <li>📅 Kreirati i pratiti svoje matcheve</li>
            <li>📊 Vidjeti detaljnu statistiku svojih igara</li>
            <li>🏆 Sudjelovati u ligama i natjecanjima</li>
            <li>👥 Povezati se s drugim igračima</li>
          </ul>
          <p>Ako imaš bilo kakvih pitanja, slobodno nam se javi!</p>
          <p>Vidimo se na terenu! 🎾</p>
          <p><strong>Padel PoC Tim</strong></p>
        </div>
        <div class="footer">
          <p>Ovo je automatski generirana poruka. Molimo ne odgovaraj na ovaj email.</p>
        </div>
      </div>
    </body>
    </html>
  `

  const text = `
Dobrodošao/la, ${displayName}!

Hvala ti na registraciji na Padel PoC platformu!

Sada možeš:
- Kreirati i pratiti svoje matcheve
- Vidjeti detaljnu statistiku svojih igara
- Sudjelovati u ligama i natjecanjima
- Povezati se s drugim igračima

Ako imaš bilo kakvih pitanja, slobodno nam se javi!

Vidimo se na terenu! 🎾

Padel PoC Tim
  `

  return sendEmail({
    to: email,
    subject: '🎾 Dobrodošao/la na Padel PoC!',
    html,
    text,
  })
}
