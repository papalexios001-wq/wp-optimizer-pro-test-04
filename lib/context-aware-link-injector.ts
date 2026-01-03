import Anthropic from '@anthropic-ai/sdk';

interface ContextualLink {
  text: string;
  url: string;
  context: string;
  relevanceScore: number;
}

interface LinkInjectionResult {
  content: string;
  linksInjected: number;
  links: ContextualLink[];
}

const QUALITY_ANCHOR_PATTERNS = [
  'learn more about',
  'discover how',
  'understand the fundamentals',
  'explore advanced strategies',
  'master the craft',
  'deep dive into',
  'comprehensive guide to',
  'proven framework',
  'step-by-step blueprint',
  'in-depth analysis',
  'complete breakdown',
  'strategic approach',
  'transformation blueprint',
  'system for',
  'methodology for'
];

const LINKING_KEYWORDS: Record<string, { urls: string[], relevanceScore: number }> = {
  'content creation': { urls: ['/content-strategy', '/seo-content-guide'], relevanceScore: 0.95 },
  'email marketing': { urls: ['/email-sequences', '/copywriting-guide'], relevanceScore: 0.92 },
  'conversion optimization': { urls: ['/conversion-funnel', '/cro-guide'], relevanceScore: 0.94 },
  'lead generation': { urls: ['/lead-magnets', '/funnel-strategy'], relevanceScore: 0.93 },
  'sales funnel': { urls: ['/funnel-strategy', '/sales-optimization'], relevanceScore: 0.95 },
  'copywriting': { urls: ['/copywriting-guide', '/persuasion-psychology'], relevanceScore: 0.91 },
  'monetization': { urls: ['/revenue-streams', '/business-model'], relevanceScore: 0.90 },
  'audience building': { urls: ['/audience-strategy', '/community-building'], relevanceScore: 0.92 },
  'seo': { urls: ['/seo-fundamentals', '/technical-seo'], relevanceScore: 0.94 },
  'analytics': { urls: ['/data-driven-strategy', '/metrics-guide'], relevanceScore: 0.88 },
  'automation': { urls: ['/marketing-automation', '/workflow-optimization'], relevanceScore: 0.89 },
  'branding': { urls: ['/brand-strategy', '/positioning-guide'], relevanceScore: 0.87 },
  'social media': { urls: ['/social-strategy', '/platform-mastery'], relevanceScore: 0.86 },
  'paid advertising': { urls: ['/ad-strategy', '/ppc-optimization'], relevanceScore: 0.91 },
  'networking': { urls: ['/relationship-building', '/partnership-strategy'], relevanceScore: 0.85 }
};

function generateQualityAnchorText(keyword: string, context: string): string {
  const pattern = QUALITY_ANCHOR_PATTERNS[
    Math.floor(Math.random() * QUALITY_ANCHOR_PATTERNS.length)
  ];
  return `${pattern} ${keyword}`;
}

function findLinkingOpportunities(content: string): Array<{ keyword: string; position: number }> {
  const opportunities: Array<{ keyword: string; position: number }> = [];
  const contentLower = content.toLowerCase();

  Object.keys(LINKING_KEYWORDS).forEach((keyword) => {
    let startIndex = 0;
    while (true) {
      const index = contentLower.indexOf(keyword, startIndex);
      if (index === -1) break;

      // Check if already linked
      const beforeText = content.substring(Math.max(0, index - 100), index);
      if (!beforeText.includes('<a ')) {
        opportunities.push({ keyword, position: index });
      }
      startIndex = index + 1;
    }
  });

  return opportunities.sort((a, b) => a.position - b.position);
}

function validateAnchorText(text: string): boolean {
  const minLength = 3;
  const maxLength = 100;
  const qualityIndicators = [
    text.length >= minLength && text.length <= maxLength,
    !text.match(/^(click|link|here|read|more)$/i),
    !text.includes('javascript:'),
    text.split(' ').length >= 2
  ];
  return qualityIndicators.filter(Boolean).length >= 3;
}

function injectLinksIntoContent(
  content: string,
  opportunities: Array<{ keyword: string; position: number }>
): LinkInjectionResult {
  const links: ContextualLink[] = [];
  let modifiedContent = content;
  let linkCount = 0;
  const maxLinks = 20;
  let offset = 0;

  opportunities.slice(0, 30).forEach((opportunity) => {
    if (linkCount >= maxLinks) return;

    const { keyword, position } = opportunity;
    const linkData = LINKING_KEYWORDS[keyword];
    if (!linkData) return;

    const url = linkData.urls[Math.floor(Math.random() * linkData.urls.length)];
    const anchorText = generateQualityAnchorText(keyword, modifiedContent);

    if (validateAnchorText(anchorText)) {
      const adjustedPosition = position + offset;
      const linkHtml = `<a href="${url}" title="${anchorText}">${anchorText}</a>`;
      
      // Find natural insertion point
      const beforeText = modifiedContent.substring(Math.max(0, adjustedPosition - 20));
      const afterText = modifiedContent.substring(adjustedPosition, adjustedPosition + 50);
      const insertionPoint = adjustedPosition + offset;

      modifiedContent = 
        modifiedContent.substring(0, insertionPoint) +
        ' ' + linkHtml + ' ' +
        modifiedContent.substring(insertionPoint);

      offset += linkHtml.length + 2;
      linkCount++;

      links.push({
        text: anchorText,
        url,
        context: `${beforeText}...${afterText}`,
        relevanceScore: linkData.relevanceScore
      });
    }
  });

  return {
    content: modifiedContent,
    linksInjected: linkCount,
    links
  };
}

export async function injectContextualLinks(
  blogContent: string,
  topic: string
): Promise<LinkInjectionResult> {
  try {
    // Find all linking opportunities
    const opportunities = findLinkingOpportunities(blogContent);

    if (opportunities.length === 0) {
      return {
        content: blogContent,
        linksInjected: 0,
        links: []
      };
    }

    // Inject links with quality validation
    const result = injectLinksIntoContent(blogContent, opportunities);

    // Ensure minimum links (15-20 range)
    if (result.linksInjected < 15 && opportunities.length > result.linksInjected) {
      // Add additional strategic links
      const additionalOpportunities = opportunities.slice(result.linksInjected + 1);
      const additionalResult = injectLinksIntoContent(result.content, additionalOpportunities);
      
      return {
        content: additionalResult.content,
        linksInjected: result.linksInjected + additionalResult.linksInjected,
        links: [...result.links, ...additionalResult.links]
      };
    }

    return result;
  } catch (error) {
    console.error('Error injecting contextual links:', error);
    return {
      content: blogContent,
      linksInjected: 0,
      links: []
    };
  }
}

export function validateLinkQuality(links: ContextualLink[]): boolean {
  if (links.length < 15) return false;
  
  const avgRelevance = links.reduce((sum, link) => sum + link.relevanceScore, 0) / links.length;
  const validAnchors = links.filter(link => validateAnchorText(link.text)).length;
  
  return avgRelevance >= 0.85 && validAnchors / links.length >= 0.9;
}

export function generateLinkStatistics(links: ContextualLink[]) {
  return {
    totalLinks: links.length,
    avgRelevanceScore: (links.reduce((sum, l) => sum + l.relevanceScore, 0) / links.length).toFixed(2),
    topLinks: links.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 5),
    qualityPercentage: (
      (links.filter(l => validateAnchorText(l.text)).length / links.length) * 100
    ).toFixed(1)
  };
}
