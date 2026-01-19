// ═══════════════════════════════════════════════════════════════════════════════
// WP OPTIMIZER PRO v28.0 — ENTERPRISE SOTA INTERNAL LINKING ENGINE
// ═══════════════════════════════════════════════════════════════════════════════
//
// 🔥 CRITICAL FIX v28.0:
// - IMPLEMENTS actual internal link injection (previous version was a stub!)
// - Generates RICH CONTEXTUAL ANCHOR TEXT (3-8 words, semantic matching)
// - TF-IDF based relevance scoring
// - Quality validation to reject thin/generic anchors
// - Position-aware placement (avoids headings, tables, FAQ question text)
//
// ANCHOR TEXT QUALITY REQUIREMENTS:
// ✓ Minimum 3 words (rejects "click here", "read more", single keywords)
// ✓ Maximum 8 words (readable, not entire sentences)
// ✓ Must be contextually relevant to target page
// ✓ Must NOT be generic ("this article", "learn more", etc.)
// ✓ Must be found naturally in source paragraph (no forced insertion)
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { InternalLinkTarget, InternalLinkResult } from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// 📌 VERSION & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const INTERNAL_LINKING_ENGINE_VERSION = "28.0.0";

// Stopwords to exclude from anchor relevance scoring
const STOPWORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
    'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how', 'all', 'each',
    'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
    'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also'
]);

// Generic anchor patterns to REJECT
const GENERIC_ANCHOR_PATTERNS = [
    /^click\s+here$/i,
    /^read\s+more$/i,
    /^learn\s+more$/i,
    /^this\s+article$/i,
    /^this\s+post$/i,
    /^this\s+guide$/i,
    /^here$/i,
    /^link$/i,
    /^source$/i,
    /^more\s+info$/i,
    /^more\s+information$/i,
    /^check\s+it\s+out$/i,
    /^see\s+more$/i,
    /^find\s+out$/i,
];

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export interface EnterpriseInternalLinkOptions {
    minLinks?: number;
    maxLinks?: number;
    minAnchorWords?: number;
    maxAnchorWords?: number;
    minRelevance?: number;
    minDistanceBetweenLinks?: number;
    maxLinksPerSection?: number;
    excludeInHeadings?: boolean;
    excludeInTables?: boolean;
    excludeInFAQQuestions?: boolean;
}

export interface EnterpriseInternalLinkResult {
    html: string;
    linksAdded: InternalLinkResult[];
    totalLinks: number;
    rejectedAnchors: Array<{ anchor: string; reason: string }>;
}

export interface AnchorCandidate {
    text: string;
    startIndex: number;
    endIndex: number;
    wordCount: number;
    relevanceScore: number;
    contextScore: number;
    qualityScore: number;
    paragraphIndex: number;
}

export interface EnhancedLinkTarget extends InternalLinkTarget {
    titleTokens: string[];
    slugTokens: string[];
    keywordTokens: string[];
    tfIdfVector: Map<string, number>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TF-IDF RELEVANCE SCORING
// ═══════════════════════════════════════════════════════════════════════════════

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

function buildTfIdfVector(tokens: string[], documentFrequency: Map<string, number>, totalDocs: number): Map<string, number> {
    const tf = new Map<string, number>();
    const vector = new Map<string, number>();
    
    // Calculate term frequency
    tokens.forEach(token => {
        tf.set(token, (tf.get(token) || 0) + 1);
    });
    
    // Calculate TF-IDF
    tf.forEach((count, term) => {
        const termFreq = count / tokens.length;
        const docFreq = documentFrequency.get(term) || 1;
        const idf = Math.log(totalDocs / docFreq);
        vector.set(term, termFreq * idf);
    });
    
    return vector;
}

function cosineSimilarity(vec1: Map<string, number>, vec2: Map<string, number>): number {
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;
    
    vec1.forEach((val, key) => {
        mag1 += val * val;
        if (vec2.has(key)) {
            dotProduct += val * vec2.get(key)!;
        }
    });
    
    vec2.forEach(val => {
        mag2 += val * val;
    });
    
    const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
    return magnitude > 0 ? dotProduct / magnitude : 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ✅ ANCHOR QUALITY VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

export function validateAnchorQuality(
    anchor: string,
    minWords: number = 3,
    maxWords: number = 8
): { valid: boolean; reason?: string } {
    const trimmed = anchor.trim();
    
    // Check length
    if (trimmed.length < 10) {
        return { valid: false, reason: 'Too short (min 10 chars)' };
    }
    
    if (trimmed.length > 100) {
        return { valid: false, reason: 'Too long (max 100 chars)' };
    }
    
    // Check word count
    const words = trimmed.split(/\s+/).filter(w => w.length > 0);
    if (words.length < minWords) {
        return { valid: false, reason: `Too few words (min ${minWords}, got ${words.length})` };
    }
    
    if (words.length > maxWords) {
        return { valid: false, reason: `Too many words (max ${maxWords}, got ${words.length})` };
    }
    
    // Check for generic patterns
    for (const pattern of GENERIC_ANCHOR_PATTERNS) {
        if (pattern.test(trimmed)) {
            return { valid: false, reason: 'Generic anchor text rejected' };
        }
    }
    
    // Check for mostly stopwords
    const nonStopwords = words.filter(w => !STOPWORDS.has(w.toLowerCase()));
    if (nonStopwords.length < 2) {
        return { valid: false, reason: 'Too many stopwords, not enough semantic content' };
    }
    
    // Check for numbers-only
    if (/^[\d\s.,]+$/.test(trimmed)) {
        return { valid: false, reason: 'Numbers-only anchor rejected' };
    }
    
    return { valid: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 RICH CONTEXTUAL ANCHOR GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate rich contextual anchor candidates from paragraph text.
 * Uses multiple strategies to find natural anchor phrases that match the target.
 */
export function generateRichAnchorCandidates(
    paragraphText: string,
    target: EnhancedLinkTarget,
    minWords: number = 3,
    maxWords: number = 8
): AnchorCandidate[] {
    const candidates: AnchorCandidate[] = [];
    const textLower = paragraphText.toLowerCase();
    const words = paragraphText.split(/\s+/);
    
    // Strategy 1: Find exact title substring matches (3-8 words)
    const titleWords = target.title.split(/\s+/);
    for (let len = Math.min(maxWords, titleWords.length); len >= minWords; len--) {
        for (let start = 0; start <= titleWords.length - len; start++) {
            const phrase = titleWords.slice(start, start + len).join(' ');
            const phraseLower = phrase.toLowerCase();
            
            const idx = textLower.indexOf(phraseLower);
            if (idx !== -1) {
                // Find the original case version in the paragraph
                const originalPhrase = paragraphText.substring(idx, idx + phrase.length);
                const validation = validateAnchorQuality(originalPhrase, minWords, maxWords);
                
                if (validation.valid) {
                    candidates.push({
                        text: originalPhrase,
                        startIndex: idx,
                        endIndex: idx + phrase.length,
                        wordCount: len,
                        relevanceScore: 0.9, // High score for title match
                        contextScore: calculateContextScore(paragraphText, idx, target),
                        qualityScore: 0.9,
                        paragraphIndex: 0
                    });
                }
            }
        }
    }
    
    // Strategy 2: Find semantic keyword clusters
    const targetKeywords = new Set([
        ...target.titleTokens,
        ...target.slugTokens,
        ...(target.keywordTokens || [])
    ]);
    
    // Look for sequences of words containing 2+ target keywords
    for (let start = 0; start < words.length; start++) {
        for (let len = minWords; len <= Math.min(maxWords, words.length - start); len++) {
            const phrase = words.slice(start, start + len).join(' ');
            const phraseTokens = tokenize(phrase);
            
            const keywordMatches = phraseTokens.filter(t => targetKeywords.has(t)).length;
            
            if (keywordMatches >= 2) {
                const validation = validateAnchorQuality(phrase, minWords, maxWords);
                
                if (validation.valid) {
                    const idx = paragraphText.indexOf(phrase);
                    if (idx !== -1) {
                        candidates.push({
                            text: phrase,
                            startIndex: idx,
                            endIndex: idx + phrase.length,
                            wordCount: len,
                            relevanceScore: 0.7 + (keywordMatches * 0.1),
                            contextScore: calculateContextScore(paragraphText, idx, target),
                            qualityScore: 0.8,
                            paragraphIndex: 0
                        });
                    }
                }
            }
        }
    }
    
    // Strategy 3: Find slug-based matches
    const slugPhrase = target.slug.replace(/-/g, ' ');
    if (textLower.includes(slugPhrase.toLowerCase())) {
        const idx = textLower.indexOf(slugPhrase.toLowerCase());
        const originalPhrase = paragraphText.substring(idx, idx + slugPhrase.length);
        const validation = validateAnchorQuality(originalPhrase, minWords, maxWords);
        
        if (validation.valid) {
            candidates.push({
                text: originalPhrase,
                startIndex: idx,
                endIndex: idx + slugPhrase.length,
                wordCount: slugPhrase.split(/\s+/).length,
                relevanceScore: 0.85,
                contextScore: calculateContextScore(paragraphText, idx, target),
                qualityScore: 0.85,
                paragraphIndex: 0
            });
        }
    }
    
    // Strategy 4: TF-IDF similarity on sliding windows
    if (target.tfIdfVector) {
        for (let start = 0; start < words.length - minWords; start++) {
            for (let len = minWords; len <= Math.min(maxWords, words.length - start); len++) {
                const phrase = words.slice(start, start + len).join(' ');
                const phraseTokens = tokenize(phrase);
                
                // Build a simple TF vector for the phrase
                const phraseVector = new Map<string, number>();
                phraseTokens.forEach(t => {
                    phraseVector.set(t, (phraseVector.get(t) || 0) + 1 / phraseTokens.length);
                });
                
                const similarity = cosineSimilarity(phraseVector, target.tfIdfVector);
                
                if (similarity > 0.3) {
                    const validation = validateAnchorQuality(phrase, minWords, maxWords);
                    
                    if (validation.valid) {
                        const idx = paragraphText.indexOf(phrase);
                        if (idx !== -1) {
                            candidates.push({
                                text: phrase,
                                startIndex: idx,
                                endIndex: idx + phrase.length,
                                wordCount: len,
                                relevanceScore: similarity,
                                contextScore: calculateContextScore(paragraphText, idx, target),
                                qualityScore: similarity * 0.9,
                                paragraphIndex: 0
                            });
                        }
                    }
                }
            }
        }
    }
    
    // Deduplicate and sort by combined score
    const seen = new Set<string>();
    return candidates
        .filter(c => {
            const key = c.text.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .sort((a, b) => {
            const scoreA = a.relevanceScore * 0.5 + a.contextScore * 0.3 + a.qualityScore * 0.2;
            const scoreB = b.relevanceScore * 0.5 + b.contextScore * 0.3 + b.qualityScore * 0.2;
            return scoreB - scoreA;
        });
}

function calculateContextScore(text: string, anchorIndex: number, target: EnhancedLinkTarget): number {
    // Check surrounding context (100 chars before and after) for relevance
    const contextStart = Math.max(0, anchorIndex - 100);
    const contextEnd = Math.min(text.length, anchorIndex + 100);
    const context = text.substring(contextStart, contextEnd).toLowerCase();
    
    const contextTokens = tokenize(context);
    const targetTokens = [...target.titleTokens, ...target.slugTokens];
    
    const matches = contextTokens.filter(t => targetTokens.includes(t)).length;
    return Math.min(1, matches / 5); // Normalize to 0-1
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📝 PARAGRAPH EXTRACTION (EXCLUDES HEADINGS/TABLES/FAQ)
// ═══════════════════════════════════════════════════════════════════════════════

interface ParagraphInfo {
    html: string;
    text: string;
    index: number;
    isExcluded: boolean;
    exclusionReason?: string;
}

function extractParagraphs(html: string, options: EnterpriseInternalLinkOptions): ParagraphInfo[] {
    const paragraphs: ParagraphInfo[] = [];
    
    // Match paragraphs with their content
    const paragraphRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let match;
    
    while ((match = paragraphRegex.exec(html)) !== null) {
        const fullMatch = match[0];
        const innerHtml = match[1];
        const text = innerHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        
        // Check exclusion rules
        let isExcluded = false;
        let exclusionReason: string | undefined;
        
        // Too short
        if (text.length < 100) {
            isExcluded = true;
            exclusionReason = 'Paragraph too short';
        }
        
        // Already has a link
        if (/<a\s+[^>]*href/i.test(innerHtml)) {
            // Check density - if more than 20% is already linked, skip
            const linkMatches = innerHtml.match(/<a[^>]*>([\s\S]*?)<\/a>/gi) || [];
            const linkedText = linkMatches.map(m => m.replace(/<[^>]*>/g, '')).join('').length;
            if (linkedText / text.length > 0.2) {
                isExcluded = true;
                exclusionReason = 'Too many existing links';
            }
        }
        
        // Check if inside heading (shouldn't happen with <p> but be safe)
        const beforeText = html.substring(Math.max(0, match.index - 50), match.index);
        if (/<h[1-6][^>]*>$/i.test(beforeText)) {
            isExcluded = true;
            exclusionReason = 'Inside heading';
        }
        
        // Check if inside table
        const tableStart = html.lastIndexOf('<table', match.index);
        const tableEnd = html.lastIndexOf('</table>', match.index);
        if (tableStart !== -1 && (tableEnd === -1 || tableStart > tableEnd)) {
            isExcluded = true;
            exclusionReason = 'Inside table';
        }
        
        // Check if inside FAQ question (but allow in answers)
        if (text.endsWith('?') || /<strong>.*\?<\/strong>/i.test(innerHtml)) {
            isExcluded = true;
            exclusionReason = 'FAQ question text';
        }
        
        paragraphs.push({
            html: fullMatch,
            text,
            index: match.index,
            isExcluded,
            exclusionReason
        });
    }
    
    return paragraphs;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔗 MAIN ENTERPRISE INTERNAL LINK INJECTION
// ═══════════════════════════════════════════════════════════════════════════════

export async function injectEnterpriseInternalLinks(
    html: string,
    linkTargets: InternalLinkTarget[],
    currentUrl: string,
    options: EnterpriseInternalLinkOptions = {},
    onProgress?: (msg: string) => void
): Promise<EnterpriseInternalLinkResult> {
    const {
        minLinks = 10,
        maxLinks = 20,
        minAnchorWords = 3,
        maxAnchorWords = 8,
        minRelevance = 0.5,
        minDistanceBetweenLinks = 400,
        maxLinksPerSection = 2,
    } = options;
    
    const log = (msg: string) => {
        onProgress?.(msg);
        console.log(`[InternalLinking] ${msg}`);
    };
    
    if (!html || !linkTargets || linkTargets.length === 0) {
        log('No content or link targets provided');
        return { html, linksAdded: [], totalLinks: 0, rejectedAnchors: [] };
    }
    
    log(`Processing ${linkTargets.length} potential link targets`);
    
    // Filter out current URL and prepare enhanced targets
    const currentSlug = extractSlugFromUrl(currentUrl);
    const availableTargets = linkTargets.filter(t => {
        const targetSlug = extractSlugFromUrl(t.url);
        return targetSlug !== currentSlug && t.url !== currentUrl;
    });
    
    log(`${availableTargets.length} targets available after filtering current page`);
    
    // Build TF-IDF vectors for all targets
    const documentFrequency = new Map<string, number>();
    const allTokens: string[][] = [];
    
    availableTargets.forEach(target => {
        const tokens = [
            ...tokenize(target.title),
            ...tokenize(target.slug.replace(/-/g, ' ')),
            ...(target.keywords || []).flatMap(k => tokenize(k))
        ];
        allTokens.push(tokens);
        
        new Set(tokens).forEach(token => {
            documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
        });
    });
    
    // Create enhanced targets with TF-IDF vectors
    const enhancedTargets: EnhancedLinkTarget[] = availableTargets.map((target, i) => ({
        ...target,
        titleTokens: tokenize(target.title),
        slugTokens: tokenize(target.slug.replace(/-/g, ' ')),
        keywordTokens: (target.keywords || []).flatMap(k => tokenize(k)),
        tfIdfVector: buildTfIdfVector(allTokens[i], documentFrequency, availableTargets.length)
    }));
    
    // Extract paragraphs
    const paragraphs = extractParagraphs(html, options);
    const eligibleParagraphs = paragraphs.filter(p => !p.isExcluded);
    
    log(`Found ${paragraphs.length} paragraphs, ${eligibleParagraphs.length} eligible for linking`);
    
    // Track state
    const linksAdded: InternalLinkResult[] = [];
    const rejectedAnchors: Array<{ anchor: string; reason: string }> = [];
    const usedTargets = new Set<string>();
    const usedAnchors = new Set<string>();
    let lastLinkPosition = -minDistanceBetweenLinks;
    let modifiedHtml = html;
    
    // Process each paragraph
    for (const para of eligibleParagraphs) {
        if (linksAdded.length >= maxLinks) {
            log(`Reached max links (${maxLinks}), stopping`);
            break;
        }
        
        // Check distance from last link
        if (para.index - lastLinkPosition < minDistanceBetweenLinks) {
            continue;
        }
        
        // Try each target
        for (const target of enhancedTargets) {
            if (usedTargets.has(target.url)) continue;
            if (linksAdded.length >= maxLinks) break;
            
            // Generate anchor candidates
            const candidates = generateRichAnchorCandidates(
                para.text,
                target,
                minAnchorWords,
                maxAnchorWords
            );
            
            // Try each candidate
            for (const candidate of candidates) {
                if (candidate.relevanceScore < minRelevance) continue;
                if (usedAnchors.has(candidate.text.toLowerCase())) continue;
                
                // Validate anchor quality one more time
                const validation = validateAnchorQuality(candidate.text, minAnchorWords, maxAnchorWords);
                if (!validation.valid) {
                    rejectedAnchors.push({ anchor: candidate.text, reason: validation.reason || 'Quality check failed' });
                    continue;
                }
                
                // Create the link
                const escapedAnchor = candidate.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const anchorRegex = new RegExp(`(?<!<a[^>]*>)\\b(${escapedAnchor})\\b(?![^<]*<\/a>)`, 'i');
                
                const link = `<a href="${target.url}" title="${escapeHtml(target.title)}">${candidate.text}</a>`;
                
                // Find and replace in the original paragraph
                const newParaHtml = para.html.replace(anchorRegex, link);
                
                if (newParaHtml !== para.html) {
                    modifiedHtml = modifiedHtml.replace(para.html, newParaHtml);
                    para.html = newParaHtml; // Update for future iterations
                    
                    linksAdded.push({
                        url: target.url,
                        anchorText: candidate.text,
                        relevanceScore: candidate.relevanceScore,
                        position: para.index
                    });
                    
                    usedTargets.add(target.url);
                    usedAnchors.add(candidate.text.toLowerCase());
                    lastLinkPosition = para.index;
                    
                    log(`   ✓ Added: "${candidate.text}" → ${target.url} (relevance: ${(candidate.relevanceScore * 100).toFixed(0)}%)`);
                    break; // Move to next paragraph
                }
            }
        }
    }
    
    log(`✅ Injected ${linksAdded.length} internal links with rich contextual anchors`);
    log(`   Rejected ${rejectedAnchors.length} low-quality anchors`);
    
    return {
        html: modifiedHtml,
        linksAdded,
        totalLinks: linksAdded.length,
        rejectedAnchors
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔍 ENHANCED LINK TARGET DISCOVERY
// ═══════════════════════════════════════════════════════════════════════════════

export async function discoverInternalLinkTargetsEnhanced(
    wpUrl: string,
    auth?: { u: string; p: string },
    options: { maxPosts?: number; excludePostId?: number } = {},
    onProgress?: (msg: string) => void
): Promise<InternalLinkTarget[]> {
    const { maxPosts = 100, excludePostId } = options;
    const log = (msg: string) => onProgress?.(msg);
    
    log(`   → Discovering internal link targets from WordPress...`);
    
    const targets: InternalLinkTarget[] = [];
    const baseUrl = wpUrl.replace(/\/+$/, '');
    
    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };
        
        if (auth?.u && auth?.p) {
            headers['Authorization'] = `Basic ${btoa(`${auth.u}:${auth.p}`)}`;
        }
        
        const url = `${baseUrl}/wp-json/wp/v2/posts?status=publish&per_page=${Math.min(100, maxPosts)}&orderby=modified&_fields=id,link,title,slug,excerpt`;
        
        const response = await fetch(url, { method: 'GET', headers });
        
        if (!response.ok) {
            log(`   ⚠️ Failed to fetch posts: ${response.status}`);
            return [];
        }
        
        const posts = await response.json();
        
        if (!Array.isArray(posts)) {
            log(`   ⚠️ Invalid response format`);
            return [];
        }
        
        for (const post of posts) {
            if (excludePostId && post.id === excludePostId) continue;
            
            // Extract title
            let title = '';
            if (typeof post.title === 'object' && post.title.rendered) {
                title = post.title.rendered.replace(/<[^>]*>/g, '').trim();
            } else if (typeof post.title === 'string') {
                title = post.title.trim();
            }
            
            if (!title || title.length < 10) continue;
            
            // Extract keywords from title and excerpt
            const keywords: string[] = [];
            
            // Title keywords (most important)
            title.toLowerCase()
                .replace(/[|\u2013\u2014:;\[\](){}\"\"''\u00ab\u00bb<>]/g, ' ')
                .split(/\s+/)
                .filter(w => w.length > 3 && !STOPWORDS.has(w))
                .slice(0, 10)
                .forEach(k => keywords.push(k));
            
            // Excerpt keywords
            if (post.excerpt?.rendered) {
                const excerptText = post.excerpt.rendered.replace(/<[^>]*>/g, '').trim();
                excerptText.toLowerCase()
                    .split(/\s+/)
                    .filter((w: string) => w.length > 4 && !STOPWORDS.has(w))
                    .slice(0, 5)
                    .forEach((k: string) => keywords.push(k));
            }
            
            targets.push({
                url: post.link,
                title: title.substring(0, 120),
                slug: post.slug,
                keywords: [...new Set(keywords)]
            });
        }
        
        log(`   ✅ Found ${targets.length} internal link targets`);
        return targets;
        
    } catch (error: any) {
        log(`   ⚠️ Link target discovery failed: ${error.message}`);
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function extractSlugFromUrl(url: string): string {
    try {
        const parsed = new URL(url);
        const pathParts = parsed.pathname.split('/').filter(Boolean);
        return pathParts[pathParts.length - 1] || '';
    } catch {
        return url.split('/').filter(Boolean).pop() || '';
    }
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📤 LEGACY EXPORTS (for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════════

// Legacy interfaces (kept for compatibility)
export interface SitemapPage {
    id: string;
    url: string;
    title: string;
    content?: string;
}

export interface InternalLinkCandidate {
    targetUrl: string;
    targetTitle: string;
    relevanceScore: number;
    suggestedAnchorText: string;
    contextSnippet: string;
    semanticMatch: number;
}

export interface LinkPlacement {
    anchorText: string;
    targetUrl: string;
    insertPosition: number;
    contextBefore: string;
    contextAfter: string;
    relevanceScore: number;
}

// Legacy function wrappers
export function calculateRelevanceScore(
    sourceContent: string,
    targetContent: string,
    targetTitle: string
): number {
    const sourceTokens = tokenize(sourceContent);
    const targetTokens = tokenize(targetContent + ' ' + targetTitle);
    
    const sourceSet = new Set(sourceTokens);
    const targetSet = new Set(targetTokens);
    
    const intersection = [...sourceSet].filter(t => targetSet.has(t));
    const union = new Set([...sourceSet, ...targetSet]);
    
    return intersection.length / Math.max(union.size, 1) * 100;
}

export function generateAnchorTextVariations(targetTitle: string): string[] {
    const variations: string[] = [];
    const words = targetTitle.split(/\s+/);
    
    // Full title
    variations.push(targetTitle);
    
    // 3-word chunks
    for (let i = 0; i <= words.length - 3; i++) {
        variations.push(words.slice(i, i + 3).join(' '));
    }
    
    // 4-word chunks
    for (let i = 0; i <= words.length - 4; i++) {
        variations.push(words.slice(i, i + 4).join(' '));
    }
    
    // 5-word chunks
    for (let i = 0; i <= words.length - 5; i++) {
        variations.push(words.slice(i, i + 5).join(' '));
    }
    
    return [...new Set(variations)];
}

export async function generateIntelligentInternalLinks(
    allPages: any[],
    currentContent: string,
    maxLinks: number = 5
): Promise<LinkPlacement[]> {
    // Convert to InternalLinkTarget format and use new engine
    const targets: InternalLinkTarget[] = allPages.map(p => ({
        url: p.url,
        title: p.title,
        slug: extractSlugFromUrl(p.url),
        keywords: tokenize(p.title)
    }));
    
    const result = await injectEnterpriseInternalLinks(
        currentContent,
        targets,
        '',
        { maxLinks }
    );
    
    return result.linksAdded.map(link => ({
        anchorText: link.anchorText,
        targetUrl: link.url,
        insertPosition: link.position,
        contextBefore: '',
        contextAfter: '',
        relevanceScore: link.relevanceScore
    }));
}

export function insertLinksIntoContent(
    htmlContent: string,
    placements: LinkPlacement[]
): string {
    let result = htmlContent;
    
    // Sort by position descending to avoid offset issues
    const sortedPlacements = [...placements].sort((a, b) => b.insertPosition - a.insertPosition);
    
    for (const placement of sortedPlacements) {
        const link = `<a href="${placement.targetUrl}">${placement.anchorText}</a>`;
        const escapedAnchor = placement.anchorText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedAnchor}\\b`, 'i');
        result = result.replace(regex, link);
    }
    
    return result;
}

export function validateLinkQuality(placements: LinkPlacement[]): { score: number; issues: string[] } {
    const issues: string[] = [];
    let totalScore = 100;
    
    placements.forEach((p, i) => {
        const validation = validateAnchorQuality(p.anchorText);
        if (!validation.valid) {
            issues.push(`Link ${i + 1}: ${validation.reason}`);
            totalScore -= 10;
        }
    });
    
    if (placements.length < 5) {
        issues.push(`Only ${placements.length} links (recommend 10+)`);
        totalScore -= 20;
    }
    
    return { score: Math.max(0, totalScore), issues };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📤 DEFAULT EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export default {
    INTERNAL_LINKING_ENGINE_VERSION,
    injectEnterpriseInternalLinks,
    discoverInternalLinkTargetsEnhanced,
    validateAnchorQuality,
    generateRichAnchorCandidates,
    // Legacy exports
    calculateRelevanceScore,
    generateAnchorTextVariations,
    generateIntelligentInternalLinks,
    insertLinksIntoContent,
    validateLinkQuality
};
