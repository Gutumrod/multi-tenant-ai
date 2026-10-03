import type { Request, Response } from 'express';
import { planRepository, subscriptionCore } from '../lib/subscriptions.js';
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

  const accountId = req.authorizedTenantId;
  if (!accountId) {
    res.status(400).json({ error: 'Missing tenant context' });
    return;
  }

  try {
    const plan = await planRepository.getById(planId);
    if (!plan) {
      res.status(404).json({ error: 'Plan not found: ' + planId, code: 'PLAN_NOT_FOUND' });
      return;
    }

    if ((plan.priceMinorUnits ?? 0) > 0) {
      res.status(403).json({
        error: 'Paid plan activation requires a trusted billing or administrative transition',
        code: 'PAID_PLAN_REQUIRES_BILLING',
      });
      return;
    }

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
    res.status(500).json({
      error: 'Subscription request failed',
      code: 'SUBSCRIPTION_REQUEST_FAILED',
    });
  }
};

export const subscriptionStatusHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  const accountId = req.authorizedTenantId;
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
  } catch (_error: unknown) {
    res.status(500).json({
      error: 'Subscription status unavailable',
      code: 'SUBSCRIPTION_STATUS_UNAVAILABLE',
    });
  }
};
