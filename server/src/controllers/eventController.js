import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Controller to fetch all logged webhook events sorted by creation date descending.
 */
export const getEvents = async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      orderBy: {
        created_at: 'desc'
      }
    });

    return res.json(events);
  } catch (error) {
    console.error('[Events Controller] Database fetch failure:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch event history logs.'
    });
  }
};
