import { z } from 'zod';

/**
 * Zod schema for wildfire_prompt_template.json format
 * Used by the fire-behavior application
 */

export const wildfireSchema = z.object({
  location: z.string().optional(),
  as_of: z.string().optional(),
  weather_risks: z.object({
    temperature: z.object({
      value: z.number(),
      units: z.enum(['F', 'C'])
    }),
    humidity: z.object({
      percent: z.number().min(0).max(100)
    }),
    wind: z.object({
      speed: z.number().min(0),
      gusts: z.number().min(0),
      direction: z.string()
    }),
    probability_of_rain: z.object({
      percent: z.number().min(0).max(100),
      time_window: z.string(),
      confidence: z.enum(['high', 'medium', 'low'])
    }).optional(),
    red_flag_warnings: z.array(z.object({
      start_time: z.string(),
      end_time: z.string(),
      level: z.enum(['Watch', 'Red Flag', 'Extreme']),
      description: z.string()
    })).optional(),
    extreme_changes: z.array(z.object({
      parameter: z.string(),
      change: z.string(),
      magnitude: z.string(),
      time_frame: z.string()
    })).optional()
  }),
  data_sources: z.array(z.object({
    name: z.string(),
    type: z.string(),
    url: z.string().optional()
  })).optional(),
  notes: z.string().optional()
});

export default wildfireSchema;
