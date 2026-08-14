import { KNOWLEDGE_SOURCE_TYPES, SUPPORT_TONE_IDS } from '@ai-customer-support/contracts';
import { z } from 'zod';

const optionalUrl = z.string().trim().url('Enter a valid URL').max(2000).optional();

export const generateBusinessProfileBodySchema = z.object({
  description: z.string().trim().min(1, 'Description is required').max(8000),
  companyName: z.string().trim().min(1).max(200).optional(),
  websiteUrl: optionalUrl,
  industry: z.string().trim().min(1).max(200).optional(),
  extraNotes: z.string().trim().min(1).max(4000).optional(),
});

export const knowledgeSourceBriefSchema = z.object({
  type: z.enum(KNOWLEDGE_SOURCE_TYPES),
  name: z.string().trim().min(1).max(200),
  url: optionalUrl,
  description: z.string().trim().min(1).max(4000).optional(),
});

export const runOnboardingSetupBodySchema = generateBusinessProfileBodySchema.extend({
  selectedToneId: z.enum(SUPPORT_TONE_IDS).optional(),
  knowledgeSources: z.array(knowledgeSourceBriefSchema).max(50).optional(),
});

export const selectSupportToneBodySchema = z.object({
  selectedToneId: z.enum(SUPPORT_TONE_IDS),
});

export const updateAgentSettingsBodySchema = z.object({
  assistantName: z.string().trim().min(1).max(80).optional(),
  greeting: z.string().trim().min(1).max(1000).optional(),
  signature: z.string().trim().max(200).nullable().optional(),
  selectedToneId: z.enum(SUPPORT_TONE_IDS).optional(),
  systemInstructions: z.string().trim().min(1).max(8000).optional(),
  allowedTopics: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  forbiddenTopics: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  escalateWhen: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  language: z.string().trim().min(1).max(64).optional(),
  collectContactInfo: z.boolean().optional(),
  handoffToHuman: z.boolean().optional(),
  maxAutonomyTurns: z.number().int().min(1).max(20).optional(),
});
