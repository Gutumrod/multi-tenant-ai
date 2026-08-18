import type { Request, Response } from 'express';
import { subscriptionCore } from '../lib/subscriptions.js';
import { SubscriptionError } from '../../../modules/subscription/core/error.js';

export const subscribeHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { planId } = req.body || {};
  if (!planId || typeof planId !== 'string') {
    res.status(400).json({ error: 'Missing or invalid planId in request body' });
    return;
  }

  const accountId = req.tenantContext?.tenantId;
  if (!accountId) {
    res.status(400).json({ error: 'Missing tenant context' });
    return;
  }

  try {
    const subscription = await subscriptionCore.createSubscription({
      accountId,
      planId,
    });
    res.status(201).json(subscription);
  } catch (error: unknown) {
    if (error instanceof SubscriptionError) {
      if (error.code === 'PLAN_NOT_FOUND') {
        res.status(404).json({ error: error.message, code: error.code });
        return;
      }
      if (error.code === 'SUBSCRIPTION_ALREADY_EXISTS') {
        res.status(409).json({ error: error.message, code: error.code });
        return;
      }
      res.status(400).json({ error: error.message, code: error.code });
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
};

export const subscriptionStatusHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  const accountId = req.tenantContext?.tenantId;
  if (!accountId) {
    res.status(400).json({ error: 'Missing tenant context' });
    return;
  }

  try {
    const subscription = await subscriptionCore.getSubscription(accountId);
    const canUseFeature = await subscriptionCore.canUseFeature(
      accountId,
      'ai_requests_per_month'
    );
    const limit = await subscriptionCore.getLimit(
      accountId,
      'ai_requests_per_month'
    );

    res.json({
      subscription,
      canUseFeature,
      limit,
      featureKey: 'ai_requests_per_month',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
};
