import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';

export function createCorsOptions(origins: string): CorsOptions {
  return {
    origin: origins.split(',').map((origin) => origin.trim()),
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}
