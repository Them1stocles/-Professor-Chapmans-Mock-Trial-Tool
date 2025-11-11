import { storage } from './storage';

// Content filtering keywords for different subjects
const NON_ENGLISH_KEYWORDS = {
  math: [
    'algebra', 'calculus', 'derivative', 'integral', 'equation', 'formula',
    'polynomial', 'matrix', 'logarithm', 'trigonometry', 'geometry', 'theorem',
    'proof', 'factor', 'variable', 'coefficient', 'quadratic', 'linear',
    'exponential', 'sine', 'cosine', 'tangent', 'pi', 'infinity', 'limit',
    'differential', 'mathematics', 'arithmetic', 'fraction', 'decimal',
    'percentage', 'statistics', 'probability', 'graph', 'coordinate',
    'angle', 'radius', 'diameter', 'circumference', 'area', 'volume',
    'perimeter', 'hypotenuse', 'vertex', 'slope', 'intercept'
  ],
  science: [
    'physics', 'chemistry', 'biology', 'cell', 'DNA', 'RNA', 'gene',
    'chromosome', 'protein', 'enzyme', 'molecule', 'atom', 'electron',
    'proton', 'neutron', 'element', 'compound', 'reaction', 'catalyst',
    'photosynthesis', 'mitosis', 'evolution', 'ecosystem', 'species',
    'habitat', 'organism', 'bacteria', 'virus', 'vaccine', 'antibiotic',
    'gravity', 'force', 'energy', 'momentum', 'velocity', 'acceleration',
    'magnetic', 'electric', 'circuit', 'voltage', 'current', 'resistance',
    'wave', 'frequency', 'wavelength', 'spectrum', 'radiation',
    'nuclear', 'atomic', 'quantum', 'periodic table', 'isotope'
  ],
  technology: [
    'programming', 'code', 'algorithm', 'python', 'java', 'javascript',
    'html', 'css', 'sql', 'database', 'server', 'client', 'api',
    'function', 'variable', 'loop', 'array', 'object', 'class',
    'inheritance', 'debugging', 'compile', 'syntax', 'framework',
    'library', 'software', 'hardware', 'computer', 'processor',
    'memory', 'storage', 'network', 'internet', 'website', 'application',
    'mobile', 'android', 'ios', 'windows', 'linux', 'mac',
    'artificial intelligence', 'machine learning', 'data science',
    'blockchain', 'cryptocurrency', 'cloud computing'
  ],
  other: [
    'economics', 'finance', 'accounting', 'business', 'marketing',
    'psychology', 'sociology', 'history', 'geography', 'politics',
    'government', 'law', 'legal', 'philosophy', 'theology', 'religion',
    'medicine', 'medical', 'health', 'anatomy', 'physiology',
    'engineering', 'mechanical', 'electrical', 'civil', 'chemical'
  ]
};

// Princess Bride and literature keywords (allowlist)
const LITERATURE_KEYWORDS = [
  'princess bride', 'westley', 'buttercup', 'inigo', 'montoya', 'fezzik',
  'vizzini', 'humperdinck', 'miracle max', 'valerie', 'albino', 'rugen',
  'morgenstern', 'goldman', 'florin', 'guilder', 'cliffs of insanity',
  'fire swamp', 'rodents of unusual size', 'dread pirate roberts',
  'six fingered man', 'as you wish', 'hello my name is inigo montoya',
  'you killed my father', 'prepare to die', 'inconceivable',
  'mostly dead', 'all dead', 'iocane powder', 'battle of wits',
  'character', 'motivation', 'plot', 'theme', 'symbolism', 'metaphor',
  'narrative', 'story', 'protagonist', 'antagonist', 'conflict',
  'resolution', 'climax', 'exposition', 'rising action', 'falling action',
  'literary device', 'irony', 'foreshadowing', 'allegory', 'satire',
  'mood', 'tone', 'setting', 'dialogue', 'monologue', 'soliloquy',
  'point of view', 'first person', 'third person', 'omniscient',
  'unreliable narrator', 'genre', 'fiction', 'fantasy', 'adventure',
  'romance', 'comedy', 'tragedy', 'epic', 'novel', 'book', 'chapter',
  'scene', 'act', 'analysis', 'interpretation', 'meaning', 'significance',
  'author', 'reader', 'audience', 'criticism', 'review', 'essay',
  'literature', 'english', 'writing', 'text', 'passage', 'quote',
  'quotation', 'excerpt', 'evidence', 'support', 'argument', 'thesis',
  'reasoning', 'logic', 'persuasion', 'rhetoric', 'style', 'voice',
  'diction', 'syntax', 'structure', 'organization', 'development'
];

// Check if content contains non-English literature keywords
export function checkContentFilter(content: string): {
  isViolation: boolean;
  category?: string;
  confidence: number;
  details: string;
} {
  const lowerContent = content.toLowerCase();
  
  // Count keywords from different categories
  const scores = {
    math: 0,
    science: 0,
    technology: 0,
    other: 0,
    literature: 0
  };
  
  // Check each category
  for (const [category, keywords] of Object.entries(NON_ENGLISH_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerContent.includes(keyword.toLowerCase())) {
        scores[category as keyof typeof scores]++;
      }
    }
  }
  
  // Check literature keywords (allowlist)
  for (const keyword of LITERATURE_KEYWORDS) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      scores.literature++;
    }
  }
  
  // Determine if this is a violation
  const totalNonLit = scores.math + scores.science + scores.technology + scores.other;
  const totalLit = scores.literature;
  
  // If has literature keywords, be more lenient
  if (totalLit > 0 && totalNonLit <= 2) {
    return {
      isViolation: false,
      confidence: 0.8,
      details: `Literature context detected (${totalLit} lit keywords, ${totalNonLit} other keywords)`
    };
  }
  
  // Strong indicators of non-English subjects
  if (totalNonLit >= 3) {
    const primaryCategory = Object.entries(scores)
      .filter(([cat]) => cat !== 'literature')
      .sort(([,a], [,b]) => b - a)[0];
    
    return {
      isViolation: true,
      category: primaryCategory[0],
      confidence: Math.min(0.9, totalNonLit / 5),
      details: `${totalNonLit} non-literature keywords detected, primarily ${primaryCategory[0]} (${primaryCategory[1]} keywords)`
    };
  }
  
  // Moderate confidence violations
  if (totalNonLit >= 2) {
    const primaryCategory = Object.entries(scores)
      .filter(([cat]) => cat !== 'literature')
      .sort(([,a], [,b]) => b - a)[0];
    
    return {
      isViolation: true,
      category: primaryCategory[0],
      confidence: 0.6,
      details: `${totalNonLit} non-literature keywords detected, possibly ${primaryCategory[0]}`
    };
  }
  
  return {
    isViolation: false,
    confidence: 0.9,
    details: 'Content appears to be literature-focused'
  };
}

// Log a content violation
export async function logContentViolation(
  studentEmail: string,
  sessionId: string | null,
  content: string,
  filterResult: ReturnType<typeof checkContentFilter>
): Promise<void> {
  try {
    // Store the full question in the detail field for admin review
    const categoryLabel = filterResult.category || 'mixed subjects';
    const detail = `[${categoryLabel.toUpperCase()}] Student asked: "${content}"\n\nFilter Analysis: ${filterResult.details} (confidence: ${(filterResult.confidence * 100).toFixed(0)}%)`;
    
    await storage.createViolationEvent({
      studentEmail,
      sessionId: sessionId || undefined,
      category: 'non-english',  // Category for filtering type
      detail: detail  // Full question + analysis
    });
    
    console.log(`Content violation logged for ${studentEmail}: ${categoryLabel} question blocked`);
  } catch (error) {
    console.error('Failed to log content violation:', error);
  }
}

// Check if content should be blocked based on settings
export async function shouldBlockContent(content: string): Promise<{
  shouldBlock: boolean;
  reason?: string;
  filterResult: ReturnType<typeof checkContentFilter>;
}> {
  try {
    const settings = await storage.getSettings();
    const filterResult = checkContentFilter(content);
    
    if (!filterResult.isViolation) {
      return { shouldBlock: false, filterResult };
    }
    
    const mode = settings?.contentFilterMode || 'normal';
    
    if (mode === 'strict') {
      // In strict mode, block any detected violations
      return {
        shouldBlock: true,
        reason: `Content appears to be about ${filterResult.category} rather than English literature. Please focus your questions on The Princess Bride characters, plot, themes, or literary analysis.`,
        filterResult
      };
    } else {
      // In normal mode, only block high-confidence violations
      if (filterResult.confidence >= 0.7) {
        return {
          shouldBlock: true,
          reason: `This question seems to be about ${filterResult.category} rather than English literature. Please ask questions related to The Princess Bride story, characters, or literary analysis.`,
          filterResult
        };
      }
    }
    
    return { shouldBlock: false, filterResult };
  } catch (error) {
    console.error('Content filter error:', error);
    // Fail open - don't block on error
    return { 
      shouldBlock: false, 
      filterResult: checkContentFilter(content)
    };
  }
}