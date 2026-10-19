import { apiClient } from './client';
import { CategoryResponseDto, CategoryType } from './types';

export async function getCategories(type?: CategoryType): Promise<CategoryResponseDto[]> {
  const query = type ? `?type=${type}` : '';
  return apiClient<CategoryResponseDto[]>(`/categories${query}`);
}

export async function getCategoryById(id: string): Promise<CategoryResponseDto> {
  return apiClient<CategoryResponseDto>(`/categories/${id}`);
}

export async function createCategory(input: {
  name: string;
  type: CategoryType;
  icon?: string;
}): Promise<CategoryResponseDto> {
  const payload: Record<string, unknown> = {
    name: input.name.trim().slice(0, 50),
    type: input.type,
  };
  if (input.icon) payload.icon = input.icon;

  return apiClient<CategoryResponseDto>('/categories', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateCategory(
  id: string,
  input: {
    name?: string;
    icon?: string;
    isArchived?: boolean;
  },
): Promise<CategoryResponseDto> {
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name.trim().slice(0, 50);
  if (input.icon !== undefined) payload.icon = input.icon;
  if (input.isArchived !== undefined) payload.isArchived = input.isArchived;

  return apiClient<CategoryResponseDto>(`/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteCategory(id: string): Promise<{ success: boolean; message: string }> {
  return apiClient<{ success: boolean; message: string }>(`/categories/${id}`, {
    method: 'DELETE',
  });
}

export const categoriesApi = {
  getCategories,
  getCategory: getCategoryById,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
