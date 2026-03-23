// User Types
export interface User {
  id: number;
  email: string;
  name: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
}

export interface UserLoginRequest {
  email: string;
  password: string;
}

export interface UserRegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

// Material Types
export type MaterialType = 'video' | 'pdf';
export type MaterialStatus = 'processing' | 'active' | 'hidden';

export interface Material {
  id: number;
  title: string;
  description?: string;
  file_path: string;
  file_size: number;
  file_type: MaterialType;
  mime_type: string;
  thumbnail_path?: string;
  status: MaterialStatus;
  view_count: number;
  download_count: number;
  like_count: number;
  is_liked_by_me?: boolean;
  uploader_id: number;
  uploader?: User;
  created_at: string;
  updated_at: string;
}

export interface MaterialCreateRequest {
  title: string;
  description?: string;
  file: File;
}

export interface MaterialUpdateRequest {
  title?: string;
  description?: string;
}

// Like Types
export interface Like {
  id: number;
  user_id: number;
  material_id: number;
  created_at: string;
}

export interface LikeToggleResponse {
  liked: boolean;
  like_count: number;
}

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface ApiSuccessResponse<T> {
  status: 'success';
  data: T;
  message?: string;
}

// Pagination Types
export interface PaginationParams {
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

// File Upload Types
export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResponse {
  id: number;
  title: string;
  status: MaterialStatus;
  message?: string;
}

// Filter Types
export interface MaterialFilter {
  type?: MaterialType;
  search?: string;
  sort_by?: 'created_at' | 'view_count' | 'like_count' | 'download_count';
  sort_order?: 'asc' | 'desc';
}

// Navigation Types
export interface NavItem {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  requiresAuth?: boolean;
}

// Component Props Types
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}
