import { z } from 'zod';

/**
 * Zod schema for RAWS API responses (Synoptic/MesoWest)
 */

const observationValueSchema = z.object({
  date_time: z.array(z.string()).optional(),
  value: z.array(z.number())
});

export const rawsStationSchema = z.object({
  STID: z.string(),
  NAME: z.string(),
  LATITUDE: z.union([z.string(), z.number()]),
  LONGITUDE: z.union([z.string(), z.number()]),
  ELEVATION: z.union([z.string(), z.number()]),
  STATE: z.string().optional(),
  TIMEZONE: z.string().optional(),
  STATUS: z.string().optional(),
  MNET_SHORTNAME: z.string().optional(),
  OBSERVATIONS: z.object({
    date_time: z.array(z.string()).optional(),
    air_temp_value_1: observationValueSchema.optional(),
    relative_humidity_value_1: observationValueSchema.optional(),
    wind_speed_value_1: observationValueSchema.optional(),
    wind_gust_value_1: observationValueSchema.optional(),
    wind_direction_value_1: observationValueSchema.optional(),
    precip_accum_value_1: observationValueSchema.optional(),
    fuel_moisture_value_1: observationValueSchema.optional(),
    solar_radiation_value_1: observationValueSchema.optional(),
    pressure_value_1: observationValueSchema.optional()
  }).optional(),
  SENSOR_VARIABLES: z.record(z.any()).optional()
});

export const rawsApiResponseSchema = z.object({
  STATION: z.array(rawsStationSchema),
  UNITS: z.object({
    temp: z.string().optional(),
    wind: z.string().optional(),
    pressure: z.string().optional(),
    precip: z.string().optional()
  }).optional(),
  SUMMARY: z.object({
    RESPONSE_CODE: z.number().optional(),
    RESPONSE_MESSAGE: z.string().optional()
  }).optional()
});

export default rawsApiResponseSchema;
