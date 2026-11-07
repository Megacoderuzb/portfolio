import type { Context, NextFunction } from "grammy";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TRACKED = 1000;

/**
 * Only the owner, only in a private chat. Anyone else gets one "Bu shaxsiy bot." per day and is ignored after that.
 * ponytail: in-memory (resets on restart, cleared at 1000 strangers); fine for a private bot.
 */
export function ownerGuard(ownerId: number, clock = () => Date.now()) {
  const answered = new Map<number, number>(); // stranger id → when we last replied

  return async (ctx: Context, next: NextFunction) => {
    const userId = ctx.from?.id;
    if (!userId || ctx.chat?.type !== "private") return;
    if (userId === ownerId) return next();

    const last = answered.get(userId);
    if (last !== undefined && clock() - last < DAY_MS) return;
    if (answered.size >= MAX_TRACKED) answered.clear();
    answered.set(userId, clock());
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    await ctx.reply("Bu shaxsiy bot.").catch(() => {});
  };
}
