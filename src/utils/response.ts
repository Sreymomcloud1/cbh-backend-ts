// src/utils/response.ts
// Standardised JSON envelope for every API response.

import { Response } from 'express';
import { ApiResponse, PaginationMeta } from '../types';

export function success<T>(
  res:        Response,
  data:       T | null  = null,
  message:    string    = 'OK',
  statusCode: number    = 200
): Response {
  const body: ApiResponse<T> = { success: true, message, data };
  return res.status(statusCode).json(body);
}

export function error(
  res:        Response,
  message:    string   = 'An error occurred',
  statusCode: number   = 500,
  errors:     string[] = []
): Response {
  const body: ApiResponse<null> = { success: false, message, data: null, errors };
  return res.status(statusCode).json(body);
}

export function paginated<T>(
  res:   Response,
  rows:  T[],
  total: number,
  page:  number,
  limit: number
): Response {
  const pagination: PaginationMeta = {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
  const body: ApiResponse<T[]> = { success: true, message: 'OK', data: rows, pagination };
  return res.status(200).json(body);
}
