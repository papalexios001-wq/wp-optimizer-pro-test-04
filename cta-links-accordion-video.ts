// CTA LINKS, FAQ ACCORDION, SCHEMA MARKUP & YOUTUBE VIDEO INTEGRATION
// WP Optimizer Pro v30.0 - Enterprise SOTA Implementation
// SOTA UI/UX Components with Modern Design System
// ═══════════════════════════════════════════════════════════════════════════════
// 🎬 IMPORTS - YouTube Video Service Integration
// ═══════════════════════════════════════════════════════════════════════════════

import { YouTubeVideoService, generateVideoEmbedHTML, injectVideoIntoContent } from './youtube-video-service';
import type { YouTubeVideoData, YouTubeSearchResult } from './types';

// ========================
// CTA BOX WITH LINKED TEXT
// ========================

export interface CTABoxConfig {
  heading: string;
  description: string;
  buttonText: string;
  targetLink: string;
  emoji?: string;
}

// Create SOTA CTA box with gradient, blur effects & modern styling
export function createCTABox(config: CTABoxConfig): string {
  const { emoji = '🚀', heading, description, buttonText, targetLink } = config;
  
  return `<div class="sota-cta-box" style="
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 48px;
    border-radius: 24px;
    margin: 64px 0;
    box-shadow: 0 20px 60px rgba(102, 126, 234, 0.3);
    position: relative;
    overflow: hidden;
  ">
    <div style="position: absolute; inset: 0; background: radial-gradient(circle at 30% 20%, rgba(255,255,255,0.1), transparent); pointer-events: none;"></div>
    <div style="position: relative; z-index: 1;">
      <h3 style="
        font-size: clamp(28px, 4vw, 42px);
        font-weight: 800;
        color: white;
        margin: 0 0 16px 0;
        letter-spacing: -0.02em;
      ">${emoji} ${heading}</h3>
      <p style="
        font-size: 18px;
        line-height: 1.7;
        color: rgba(255,255,255,0.9);
        margin: 0 0 32px 0;
        max-width: 600px;
      ">${description}</p>
      <a href="${targetLink}" class="sota-cta-btn" style="
        display: inline-flex;
        align-items: center;
        gap: 12px;
        background: white;
        color: #667eea;
        padding: 18px 36px;
        border-radius: 12px;
        text-decoration: none;
        font-weight: 700;
        font-size: 16px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 12px 32px rgba(0,0,0,0.2)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 8px 24px rgba(0,0,0,0.15)';">
        ${buttonText}
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </a>
    </div>
  </div>`;
}

// ========================
// ENTERPRISE FAQ ACCORDION
// ========================

export interface FAQItem {
  question: string;
  answer: string;
}

// Create SOTA FAQ accordion with smooth animations
export function createEnterpriseAccordion(items: FAQItem[], title: string = '💬 Frequently Asked Questions'): string {
  let html = `<section class="sota-faq-section" style="
    margin: 64px 0;
    background: linear-gradient(to bottom, #f9fafb, #ffffff);
    padding: 56px;
    border-radius: 24px;
    border: 1px solid rgba(0,0,0,0.06);
  ">
    <h2 style="
      font-size: clamp(32px, 5vw, 48px);
      font-weight: 800;
      color: #1f2937;
      margin: 0 0 40px 0;
      letter-spacing: -0.03em;
    ">${title}</h2>
    <div class="faq-container" role="region" aria-label="FAQ">`;

  items.forEach((item, index) => {
    html += `<details class="faq-item-sota" style="
      margin-bottom: 16px;
      background: white;
      border: 2px solid #e5e7eb;
      border-radius: 16px;
      overflow: hidden;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    " onmouseover="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 10px 30px rgba(59, 130, 246, 0.1)';" onmouseout="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none';">
      <summary style="
        padding: 24px 28px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        cursor: pointer;
        font-weight: 700;
        font-size: 18px;
        list-style: none;
        display: flex;
        align-items: center;
        gap: 16px;
        transition: all 0.3s ease;
      ">
        <span style="
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: rgba(255,255,255,0.2);
          border-radius: 8px;
          font-weight: 800;
          flex-shrink: 0;
        ">${index + 1}</span>
        <span>${item.question}</span>
      </summary>
      <div style="
        padding: 32px;
        background: linear-gradient(to bottom, #f9fafb, white);
      ">
        <p style="
          color: #4b5563;
          line-height: 1.8;
          font-size: 16px;
          margin: 0;
        ">${item.answer}</p>
      </div>
    </details>`;
  });

  html += `</div></section>`;
  return html;
}

// ========================
// REFERENCES SECTION - SOTA
// ========================

export interface Reference {
  title: string;
  url: string;
  source?: string;
  author?: string;
}

export function createReferencesSection(references: Reference[]): string {
  if (!references || references.length === 0) return '';
  
  let html = `<section class="sota-references" style="
    margin: 64px 0;
    background: linear-gradient(to bottom, #f9fafb, #ffffff);
    padding: 48px;
    border-radius: 24px;
    border: 1px solid rgba(0,0,0,0.06);
  ">
    <h2 style="
      font-size: 28px;
      font-weight: 800;
      color: #1f2937;
      margin: 0 0 32px 0;
    ">📚 References</h2>
    <ol style="margin: 0; padding-left: 24px;">`;
  
  references.forEach((ref) => {
    html += `<li style="margin-bottom: 16px; color: #4b5563; line-height: 1.6;">
      <a href="${ref.url}" style="color: #3b82f6; text-decoration: none; font-weight: 600;" target="_blank" rel="noopener">${ref.title}</a>
      ${ref.source ? `<span style="color: #9ca3af;"> — ${ref.source}</span>` : ''}
    </li>`;
  });
  
  html += `</ol></section>`;
  return html;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎬 YOUTUBE VIDEO INTEGRATION - SERPER.DEV API POWERED
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ENTERPRISE-GRADE YouTube Video Integration with Serper.dev API
 * 
 * This function uses the YouTubeVideoService to:
 * 1. Search for relevant videos using Serper.dev API
 * 2. Score and validate video quality
 * 3. Select the best matching video
 * 4. Generate SEO-optimized embed HTML
 * 5. Inject the video into the content at the optimal position
 * 
 * @param htmlContent - The HTML content to inject the video into
 * @param articleTitle - The article title for video search
 * @param serperApiKey - Serper.dev API key for video discovery
 * @param log - Optional logging callback
 * @returns Promise<string> - HTML content with embedded YouTube video
 */
export async function integrateYouTubeVideoIntoContent(
  htmlContent: string,
  articleTitle: string,
  serperApiKey?: string,
  log?: (msg: string) => void
): Promise<string> {
  // If no Serper API key provided, return content unchanged
  if (!serperApiKey || serperApiKey.trim() === '') {
    log?.('⚠️ YouTube integration skipped: No Serper API key provided');
    return htmlContent;
  }

  try {
    log?.('🎬 Starting YouTube video discovery via Serper.dev API...');
    
    // Initialize the YouTube Video Service with Serper API
    const youtubeService = new YouTubeVideoService({
      serperApiKey: serperApiKey,
      minViews: 1000,
      minDuration: 60,    // Minimum 1 minute
      maxDuration: 3600,  // Maximum 1 hour
      enableCaching: true
    });

    // Search for the best video using multiple strategies
    log?.(`🔍 Searching for videos related to: "${articleTitle}"`);
    const searchResult = await youtubeService.findBestVideo(
      articleTitle,
      articleTitle // Use article title as target keyword
    );

    // Check if a video was found
    if (!searchResult.video) {
      log?.('⚠️ No suitable YouTube video found for this topic');
      return htmlContent;
    }

    const video = searchResult.video;
    log?.(`✅ Found video: "${video.title}" by ${video.channel}`);
    log?.(`   Video ID: ${video.videoId}`);
    log?.(`   Source: ${searchResult.source}`);

    // Validate the video is still accessible
    const isValid = await youtubeService.validateVideo(video.videoId);
    if (!isValid) {
      log?.('⚠️ Video validation failed - video may be unavailable');
      return htmlContent;
    }
    log?.('✅ Video validation passed');

    // Generate the embed HTML with SEO schema markup
    const embedHtml = youtubeService.generateEmbed(video, articleTitle, 'full');
    log?.('🎬 Generated responsive video embed with VideoObject schema');

    // Inject the video into the content at the optimal position
    const enrichedContent = injectVideoIntoContent(
      htmlContent,
      video,
      articleTitle,
      'after-intro' // Position after the introduction
    );

    log?.('✅ YouTube video successfully integrated into content');
    return enrichedContent;

  } catch (error: any) {
    log?.(`❌ YouTube integration error: ${error.message}`);
    // Return original content on error - graceful degradation
    return htmlContent;
  }
}

/**
 * Legacy function for backward compatibility
 * Embeds a specific video by ID (without Serper search)
 */
export function embedYouTubeVideoById(
  htmlContent: string,
  videoId: string,
  timestamp?: string,
  title?: string
): string {
  if (!videoId) return htmlContent;
  
  const embedUrl = `https://www.youtube.com/embed/${videoId}${timestamp ? `?start=${timestamp}` : ''}`;
  
  const videoEmbed = `<!-- YouTube Video Section -->
<div class="sota-video-embed" style="
  margin: 48px 0;
  position: relative;
  width: 100%;
  padding-bottom: 56.25%;
  height: 0;
  overflow: hidden;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(102, 126, 234, 0.15);
">
  <iframe
    style="
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border: none;
      border-radius: 16px;
    "
    src="${embedUrl}"
    title="${title || 'YouTube video'}"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowFullScreen
    loading="lazy">
  </iframe>
</div>
<!-- End YouTube Video Section -->`;
  
  return htmlContent + videoEmbed;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📤 DEFAULT EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default { 
  createCTABox, 
  createEnterpriseAccordion, 
  createReferencesSection, 
  integrateYouTubeVideoIntoContent,
  embedYouTubeVideoById
};
