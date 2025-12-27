/**
 * Docker Image Selector Component
 * Displays popular Docker images with descriptions and allows easy selection
 */

import { useState, useMemo } from 'react';
import { Search, Download, Check, X, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

export interface DockerImage {
  name: string;
  fullName: string;
  description: string;
  tags: string[];
  category: 'pytorch' | 'tensorflow' | 'jupyter' | 'base' | 'ml' | 'data';
  official: boolean;
  stars?: number;
  size?: string;
}

const POPULAR_DOCKER_IMAGES: DockerImage[] = [
  {
    name: 'PyTorch',
    fullName: 'pytorch/pytorch',
    description: 'PyTorch deep learning framework with CUDA support',
    tags: ['latest', '2.1.0', '2.0.1', '1.13.1', 'nightly'],
    category: 'pytorch',
    official: true,
    stars: 8500,
    size: '4.2GB',
  },
  {
    name: 'PyTorch (CPU)',
    fullName: 'pytorch/pytorch',
    description: 'PyTorch CPU-only version, smaller footprint',
    tags: ['latest-cpu', '2.1.0-cpu', '2.0.1-cpu'],
    category: 'pytorch',
    official: true,
    size: '1.8GB',
  },
  {
    name: 'TensorFlow',
    fullName: 'tensorflow/tensorflow',
    description: 'TensorFlow deep learning framework',
    tags: ['latest', '2.15.0', '2.14.0', '2.13.0', 'latest-gpu'],
    category: 'tensorflow',
    official: true,
    stars: 12000,
    size: '3.5GB',
  },
  {
    name: 'TensorFlow (GPU)',
    fullName: 'tensorflow/tensorflow',
    description: 'TensorFlow with GPU support',
    tags: ['latest-gpu', '2.15.0-gpu', '2.14.0-gpu'],
    category: 'tensorflow',
    official: true,
    size: '5.1GB',
  },
  {
    name: 'Jupyter Notebook',
    fullName: 'jupyter/scipy-notebook',
    description: 'Jupyter with scientific Python stack (NumPy, SciPy, Pandas)',
    tags: ['latest', '2023-10-16', '2023-09-18'],
    category: 'jupyter',
    official: true,
    stars: 3500,
    size: '2.1GB',
  },
  {
    name: 'Jupyter TensorFlow',
    fullName: 'jupyter/tensorflow-notebook',
    description: 'Jupyter with TensorFlow pre-installed',
    tags: ['latest', '2023-10-16'],
    category: 'jupyter',
    official: true,
    size: '4.2GB',
  },
  {
    name: 'Python Base',
    fullName: 'python',
    description: 'Official Python base image',
    tags: ['3.11', '3.10', '3.9', '3.11-slim', '3.10-slim'],
    category: 'base',
    official: true,
    stars: 5000,
    size: '150MB',
  },
  {
    name: 'Scikit-learn',
    fullName: 'continuumio/miniconda3',
    description: 'Miniconda with scikit-learn and data science tools',
    tags: ['latest', '23.9.0-0'],
    category: 'ml',
    official: false,
    size: '800MB',
  },
  {
    name: 'Hugging Face',
    fullName: 'huggingface/transformers-pytorch-gpu',
    description: 'Hugging Face Transformers with PyTorch and GPU support',
    tags: ['latest', '4.35.0'],
    category: 'ml',
    official: false,
    stars: 2800,
    size: '6.5GB',
  },
  {
    name: 'MLflow',
    fullName: 'ghcr.io/mlflow/mlflow',
    description: 'MLflow for experiment tracking and model management',
    tags: ['latest', 'v2.8.0'],
    category: 'ml',
    official: false,
    size: '1.2GB',
  },
  {
    name: 'Apache Spark',
    fullName: 'bitnami/spark',
    description: 'Apache Spark for big data processing',
    tags: ['latest', '3.5.0'],
    category: 'data',
    official: false,
    size: '2.8GB',
  },
  {
    name: 'XGBoost (Python)',
    fullName: 'python',
    description: 'Python image - install XGBoost via pip: pip install xgboost',
    tags: ['3.11', '3.10', '3.9'],
    category: 'ml',
    official: true,
    size: '150MB',
  },
];

interface DockerImageSelectorProps {
  selectedImage?: string;
  selectedTag?: string;
  onSelect: (image: string, tag: string) => void;
  onPull?: (image: string, tag: string) => Promise<void>;
  pulledImages?: Set<string>;
  pullingImages?: Set<string>;
  className?: string;
}

export function DockerImageSelector({
  selectedImage,
  selectedTag,
  onSelect,
  onPull,
  pulledImages = new Set(),
  pullingImages = new Set(),
  className = '',
}: DockerImageSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const categories = useMemo(() => {
    const cats = new Set(POPULAR_DOCKER_IMAGES.map(img => img.category));
    return ['all', ...Array.from(cats)];
  }, []);

  const filteredImages = useMemo(() => {
    return POPULAR_DOCKER_IMAGES.filter(img => {
      const matchesSearch =
        searchQuery === '' ||
        img.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        img.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        img.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = selectedCategory === 'all' || img.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const getImageKey = (image: string, tag: string) => `${image}:${tag}`;

  const isPulled = (image: string, tag: string) => {
    return pulledImages.has(getImageKey(image, tag));
  };

  const isPulling = (image: string, tag: string) => {
    return pullingImages.has(getImageKey(image, tag));
  };

  const handlePull = async (image: DockerImage, tag: string) => {
    if (onPull) {
      // Pass the full image name with tag, and the tag separately
      // The backend will handle it correctly
      await onPull(`${image.fullName}:${tag}`, tag);
    }
  };

  return (
    <div className={className}>
      {/* Search and Filters */}
      <div className="space-y-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-subtle)]" />
          <input
            type="text"
            placeholder="Search Docker images..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
          />
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
            >
              {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Images Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredImages.map((image) => {
          const defaultTag = image.tags[0];
          const isSelected = selectedImage === image.fullName && selectedTag === defaultTag;
          const isExpanded = expandedImage === image.fullName;

          return (
            <Card
              key={image.fullName}
              className={`cursor-pointer transition-all hover:border-[var(--accent-primary)] ${
                isSelected ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/20' : ''
              }`}
              onClick={() => {
                if (!isExpanded) {
                  setExpandedImage(image.fullName);
                }
                onSelect(image.fullName, defaultTag);
              }}
            >
              <div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-[var(--text-primary)]">{image.name}</h3>
                      {image.official && (
                        <Badge variant="accent" className="text-xs">
                          Official
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-subtle)] font-mono">{image.fullName}</p>
                  </div>
                  {image.stars && (
                    <div className="flex items-center gap-1 text-xs text-[var(--text-subtle)]">
                      <span>⭐</span>
                      <span>{image.stars.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Description */}
                <p className="text-sm text-[var(--text-secondary)] mb-3">{image.description}</p>

                {/* Tags */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-[var(--border-primary)]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-[var(--text-subtle)]">Available Tags:</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedImage(null);
                        }}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {image.tags.map((tag) => {
                        const pulled = isPulled(image.fullName, tag);
                        const pulling = isPulling(image.fullName, tag);
                        const tagSelected = selectedImage === image.fullName && selectedTag === tag;

                        return (
                          <div
                            key={tag}
                            className="flex items-center gap-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelect(image.fullName, tag);
                            }}
                          >
                            <Badge
                              variant={tagSelected ? 'accent' : 'default'}
                              className={`cursor-pointer text-xs ${
                                tagSelected ? 'ring-2 ring-[var(--accent-primary)]' : ''
                              }`}
                            >
                              {tag}
                            </Badge>
                            {pulled ? (
                              <Check className="w-3 h-3 text-[var(--success)]" />
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await handlePull(image, tag);
                                }}
                                disabled={pulling}
                              >
                                {pulling ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Download className="w-3 h-3" />
                                )}
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {image.size && (
                      <div className="mt-2 text-xs text-[var(--text-subtle)]">
                        Size: {image.size}
                      </div>
                    )}
                  </div>
                )}

                {/* Quick Actions */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-primary)]">
                  {isPulled(image.fullName, defaultTag) ? (
                    <div className="flex items-center gap-1 text-xs text-[var(--success)]">
                      <Check className="w-3 h-3" />
                      <span>Pulled</span>
                    </div>
                  ) : (
                    onPull && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await handlePull(image, defaultTag);
                        }}
                        disabled={isPulling(image.fullName, defaultTag)}
                      >
                        {isPulling(image.fullName, defaultTag) ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Pulling...
                          </>
                        ) : (
                          <>
                            <Download className="w-3 h-3" />
                            Pull Image
                          </>
                        )}
                      </Button>
                    )
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`https://hub.docker.com/r/${image.fullName}`, '_blank');
                    }}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {filteredImages.length === 0 && (
        <div className="text-center py-12 text-[var(--text-subtle)]">
          No Docker images found matching your search.
        </div>
      )}
    </div>
  );
}

