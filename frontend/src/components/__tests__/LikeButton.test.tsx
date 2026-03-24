import { render, screen, fireEvent } from '@testing-library/react';
import { LikeButton } from '../LikeButton';

describe('LikeButton', () => {
  const defaultProps = {
    isLiked: false,
    likeCount: 10,
    isLoading: false,
    onToggle: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with correct initial state', () => {
    render(<LikeButton {...defaultProps} />);

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should display filled heart when liked', () => {
    render(<LikeButton {...defaultProps} isLiked={true} />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveAttribute('aria-label', '取消点赞');
  });

  it('should display outline heart when not liked', () => {
    render(<LikeButton {...defaultProps} isLiked={false} />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveAttribute('aria-label', '点赞');
  });

  it('should call onToggle when clicked', () => {
    render(<LikeButton {...defaultProps} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(defaultProps.onToggle).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when isLoading is true', () => {
    render(<LikeButton {...defaultProps} isLoading={true} />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should show loading state with ellipsis', () => {
    render(<LikeButton {...defaultProps} isLoading={true} />);

    expect(screen.getByText('...')).toBeInTheDocument();
  });

  it('should format like counts with locale string', () => {
    render(<LikeButton {...defaultProps} likeCount={1500} />);

    expect(screen.getByText('1,500')).toBeInTheDocument();
  });

  it('should support different sizes', () => {
    const { rerender } = render(<LikeButton {...defaultProps} size="sm" />);
    expect(screen.getByText('10')).toHaveClass('text-sm');

    rerender(<LikeButton {...defaultProps} size="lg" />);
    expect(screen.getByText('10')).toHaveClass('text-lg');
  });

  it('should hide count when showCount is false', () => {
    render(<LikeButton {...defaultProps} showCount={false} />);

    expect(screen.queryByText('10')).not.toBeInTheDocument();
    expect(screen.getByText('点赞')).toBeInTheDocument();
  });

  it('should show "已点赞" text when liked and count hidden', () => {
    render(<LikeButton {...defaultProps} isLiked={true} showCount={false} />);

    expect(screen.getByText('已点赞')).toBeInTheDocument();
  });
});
