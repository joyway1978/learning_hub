import { render, screen, fireEvent } from '@testing-library/react';
import { MaterialCard } from '../MaterialCard';
import { Material } from '@/types';

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

describe('MaterialCard', () => {
  const mockMaterial: Material = {
    id: 1,
    title: 'Test Material Title',
    description: 'Test Description',
    file_path: '/path/test.mp4',
    file_size: 1024000,
    file_type: 'video',
    mime_type: 'video/mp4',
    status: 'active',
    view_count: 100,
    download_count: 50,
    like_count: 25,
    uploader_id: 1,
    uploader: {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
    },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  it('should render material information correctly', () => {
    render(<MaterialCard material={mockMaterial} />);

    expect(screen.getByText('Test Material Title')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument(); // view count
    expect(screen.getByText('25')).toBeInTheDocument(); // like count
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('视频')).toBeInTheDocument();
  });

  it('should render PDF type correctly', () => {
    const pdfMaterial: Material = {
      ...mockMaterial,
      file_type: 'pdf',
      mime_type: 'application/pdf',
    };

    render(<MaterialCard material={pdfMaterial} />);

    expect(screen.getByText('PDF')).toBeInTheDocument();
  });

  it('should display unknown user when uploader is not available', () => {
    const materialWithoutUploader: Material = {
      ...mockMaterial,
      uploader: undefined,
    };

    render(<MaterialCard material={materialWithoutUploader} />);

    expect(screen.getByText('未知用户')).toBeInTheDocument();
  });

  it('should render processing status badge', () => {
    const processingMaterial: Material = {
      ...mockMaterial,
      status: 'processing',
    };

    render(<MaterialCard material={processingMaterial} />);

    expect(screen.getByText('处理中')).toBeInTheDocument();
  });

  it('should render hidden status badge', () => {
    const hiddenMaterial: Material = {
      ...mockMaterial,
      status: 'hidden',
    };

    render(<MaterialCard material={hiddenMaterial} />);

    expect(screen.getByText('已隐藏')).toBeInTheDocument();
  });

  it('should link to material detail page', () => {
    render(<MaterialCard material={mockMaterial} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/materials/1');
  });

  it('should handle image load error gracefully', () => {
    render(<MaterialCard material={mockMaterial} />);

    const img = screen.getByAltText('Test Material Title');

    // Simulate image load error
    fireEvent.error(img);

    // After error, the image should still be in document but with error state handled
    expect(img).toBeInTheDocument();
  });

  it('should render with thumbnail path', () => {
    const materialWithThumbnail: Material = {
      ...mockMaterial,
      thumbnail_path: '/thumbnails/1.jpg',
    };

    render(<MaterialCard material={materialWithThumbnail} />);

    const img = screen.getByAltText('Test Material Title');
    expect(img).toHaveAttribute('src', expect.stringContaining('/api/v1/materials/1/thumbnail'));
  });

  it('should display formatted date', () => {
    render(<MaterialCard material={mockMaterial} />);

    // Date should be displayed in relative format
    expect(screen.getByText(/前$/)).toBeInTheDocument();
  });
});
