import { google } from 'googleapis'
import { prisma } from './prisma'
import { Readable } from 'stream'

export async function getGoogleDriveClient(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: 'google' },
  })

  if (!account?.refresh_token) {
    throw new Error('NO_GOOGLE_ACCOUNT')
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!
  )

  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  })

  // Refresh token if expired
  const now = Date.now()
  if (account.expires_at && account.expires_at * 1000 < now) {
    const { credentials } = await oauth2Client.refreshAccessToken()
    oauth2Client.setCredentials(credentials)

    await prisma.account.update({
      where: { id: account.id },
      data: {
        access_token: credentials.access_token,
        expires_at: credentials.expiry_date
          ? Math.floor(credentials.expiry_date / 1000)
          : undefined,
      },
    })
  }

  return google.drive({ version: 'v3', auth: oauth2Client })
}

export async function uploadToDrive(
  userId: string,
  filename: string,
  buffer: Buffer
) {
  const drive = await getGoogleDriveClient(userId)

  const response = await drive.files.create({
    requestBody: {
      name: filename,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    media: {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: Readable.from(buffer),
    },
    fields: 'id, webViewLink',
  })

  return {
    fileId: response.data.id,
    webViewLink: response.data.webViewLink,
  }
}
