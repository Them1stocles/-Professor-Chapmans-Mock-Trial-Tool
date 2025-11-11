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
  // Princess Bride characters and locations
  'princess bride', 'westley', 'buttercup', 'inigo', 'montoya', 'fezzik',
  'vizzini', 'humperdinck', 'miracle max', 'valerie', 'albino', 'rugen',
  'morgenstern', 'goldman', 'florin', 'guilder', 'cliffs of insanity',
  'fire swamp', 'rodents of unusual size', 'dread pirate roberts',
  'six fingered man', 'as you wish', 'hello my name is inigo montoya',
  'you killed my father', 'prepare to die', 'inconceivable',
  'mostly dead', 'all dead', 'iocane powder', 'battle of wits',
  
  // Princess Bride plot-relevant terms (prevent false positives)
  'murder', 'murdered', 'kill', 'killed', 'killing', 'death', 'die', 'dying', 'dead',
  'kidnap', 'kidnapped', 'kidnapping', 'capture', 'captured', 'abduct',
  'torture', 'tortured', 'pain', 'suffering', 'machine',
  'poison', 'poisoned', 'iocane',
  'sword', 'fight', 'fighting', 'duel', 'battle', 'combat', 'fencing',
  'revenge', 'vengeance', 'avenge',
  'love', 'true love', 'romance', 'marry', 'marriage', 'wedding', 'bride', 'groom',
  'giant', 'monster', 'beast', 'rodent', 'rous',
  'fire', 'swamp', 'cliff', 'castle', 'pit', 'despair',
  'miracle', 'magic', 'witch', 'wizard',
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

// Question patterns that indicate non-literature queries
const QUESTION_PATTERNS = {
  homework: /^(what is|explain|define|how does|calculate|solve|find the|prove|show that)/i,
  directAnswer: /^(what'?s|whats|tell me about|give me|list)/i,
};

// Check if content contains non-English literature keywords
export function checkContentFilter(content: string): {
  isViolation: boolean;
  category?: string;
  confidence: number;
  details: string;
} {
  const lowerContent = content.toLowerCase();
  const trimmedContent = content.trim();
  
  // Count keywords from different categories
  const scores = {
    math: 0,
    science: 0,
    technology: 0,
    other: 0,
    literature: 0
  };
  
  const detectedKeywords = {
    math: [] as string[],
    science: [] as string[],
    technology: [] as string[],
    other: [] as string[],
  };
  
  // Check each category and track which keywords were found
  for (const [category, keywords] of Object.entries(NON_ENGLISH_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerContent.includes(keyword.toLowerCase())) {
        scores[category as keyof typeof scores]++;
        detectedKeywords[category as keyof typeof detectedKeywords].push(keyword);
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
  
  // Check if question matches homework/direct answer patterns
  const isHomeworkPattern = QUESTION_PATTERNS.homework.test(trimmedContent) || 
                           QUESTION_PATTERNS.directAnswer.test(trimmedContent);
  
  // STRICT MODE: Block single non-lit keyword if it's a direct question pattern
  if (totalNonLit >= 1 && isHomeworkPattern && totalLit === 0) {
    const primaryCategory = Object.entries(scores)
      .filter(([cat]) => cat !== 'literature')
      .sort(([,a], [,b]) => b - a)[0];
    
    const keywords = detectedKeywords[primaryCategory[0] as keyof typeof detectedKeywords];
    
    return {
      isViolation: true,
      category: primaryCategory[0],
      confidence: 0.85,
      details: `Direct ${primaryCategory[0]} question detected. Keywords: ${keywords.join(', ')}. No literature context found.`
    };
  }
  
  // If has strong literature context, be more lenient
  if (totalLit >= 3 && totalNonLit <= 2) {
    return {
      isViolation: false,
      confidence: 0.9,
      details: `Strong literature context detected (${totalLit} lit keywords, ${totalNonLit} other keywords)`
    };
  }
  
  // If has some literature keywords, require more non-lit keywords to block
  if (totalLit > 0 && totalNonLit <= 2) {
    return {
      isViolation: false,
      confidence: 0.8,
      details: `Literature context detected (${totalLit} lit keywords, ${totalNonLit} other keywords)`
    };
  }
  
  // Strong indicators of non-English subjects (3+ keywords)
  if (totalNonLit >= 3) {
    const primaryCategory = Object.entries(scores)
      .filter(([cat]) => cat !== 'literature')
      .sort(([,a], [,b]) => b - a)[0];
    
    const keywords = detectedKeywords[primaryCategory[0] as keyof typeof detectedKeywords];
    
    return {
      isViolation: true,
      category: primaryCategory[0],
      confidence: Math.min(0.95, totalNonLit / 5),
      details: `${totalNonLit} non-literature keywords detected, primarily ${primaryCategory[0]}. Keywords: ${keywords.slice(0, 5).join(', ')}`
    };
  }
  
  // Moderate confidence violations (2 keywords)
  if (totalNonLit >= 2) {
    const primaryCategory = Object.entries(scores)
      .filter(([cat]) => cat !== 'literature')
      .sort(([,a], [,b]) => b - a)[0];
    
    const keywords = detectedKeywords[primaryCategory[0] as keyof typeof detectedKeywords];
    
    return {
      isViolation: true,
      category: primaryCategory[0],
      confidence: 0.7,
      details: `${totalNonLit} non-literature keywords detected, possibly ${primaryCategory[0]}. Keywords: ${keywords.join(', ')}`
    };
  }
  
  // Single keyword but no homework pattern - allow (might be incidental)
  if (totalNonLit === 1 && !isHomeworkPattern) {
    return {
      isViolation: false,
      confidence: 0.6,
      details: `Single non-literature keyword detected but appears contextual`
    };
  }
  
  return {
    isViolation: false,
    confidence: 0.95,
    details: 'Content appears to be literature-focused'
  };
}

// Log a content violation
export async function logContentViolation(
  studentEmail: string,
  sessionId: string | null,
  content: string,
  filterResult: ReturnType<typeof checkContentFilter>,
  status: 'flagged' | 'blocked' | 'proceeded' = 'flagged'
): Promise<string | null> {
  try {
    // Store the full question in the detail field for admin review
    const categoryLabel = filterResult.category || 'mixed subjects';
    const detail = `[${categoryLabel.toUpperCase()}] Student asked: "${content}"\n\nFilter Analysis: ${filterResult.details} (confidence: ${(filterResult.confidence * 100).toFixed(0)}%)`;
    
    const event = await storage.createViolationEvent({
      studentEmail,
      sessionId: sessionId || undefined,
      category: 'non-english',  // Category for filtering type
      detail: detail,  // Full question + analysis
      status
    });
    
    console.log(`Content violation logged for ${studentEmail}: ${categoryLabel} question ${status}`);
    return event.id;
  } catch (error) {
    console.error('Failed to log content violation:', error);
    return null;
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