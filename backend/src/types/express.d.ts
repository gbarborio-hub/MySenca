// Copyright (c) 2026 Giovanni Arborio Mella. All rights reserved.
//
// Estende Request di Express con "user", popolato da auth.middleware.ts dopo aver
// verificato il token. Da qui in poi ogni controller può leggere req.user invece
// di fidarsi di header non verificati.
import type { TokenPayload } from "../services/TokenService.js";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export {};
