import { apiClient } from './client';
import {
  ImportRowDto,
  ImportPreviewResponseDto,
  ImportCommitResponseDto,
} from './types';

export interface ImportPreviewRequestDto {
  accountId: string;
  rows: ImportRowDto[];
}

export interface ImportCommitRequestDto {
  sessionId: string;
  /** Row indices to import (those with status 'NEW'). */
  includeIndices?: number[];
}

export const importApi = {
  async previewImport(dto: ImportPreviewRequestDto): Promise<ImportPreviewResponseDto> {
    return apiClient.post<ImportPreviewResponseDto>('/import/preview', dto);
  },

  async commitImport(dto: ImportCommitRequestDto): Promise<ImportCommitResponseDto> {
    return apiClient.post<ImportCommitResponseDto>('/import/commit', dto);
  },
};
