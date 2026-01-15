// ═══════════════════════════════════════════════════════════════════════════════
// WP OPTIMIZER PRO v27.0 — YOUTUBE VIDEO DISCOVERY SERVICE
// ═══════════════════════════════════════════════════════════════════════════════
// 
// Uses Serper.dev API to:
// ✅ Search for high-quality, relevant YouTube videos
// ✅ Filter by minimum views, recency, and relevance
// ✅ Validate video availability
// ✅ Generate beautiful embeds
// ═══════════════════════════════════════════════════════════════════════════════

export const YOUTUBE_SERVICE_VERSION = "27.0.0";

// ═══════════════════════════════════════════════════════════════════════════════
// 📌 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface YouTubeVideoData {
    videoId: string;
    title: string;
    channel: string;
    channelUrl?: string;
    views: number;
    duration?: string;
    thumbnailUrl: string;
    embedUrl: string;
    publishedAt?: string;
    description?: string;
    relevanceScore: number;
}

export interface YouTubeSearchOptions {
    minViews?: number;
    maxAgeDays?: number;
    preferredChannels?: string[];
    excludeChannels?: string[];
    maxResults?: number;
    language?: string;
    country?: string;
}

export interface YouTubeSearchResult {
    video: YouTubeVideoData | null;
    alternativeVideos: YouTubeVideoData[];
    searchQuery: string;
    source: 'serper' | 'fallback';
    searchTime: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function extractYouTubeVideoId(url: string): string | null {
    if (!url) return null;
    
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) return match[1];
    }
    
    return null;
}

function parseViewCount(viewString: string | number | undefined): number {
    if (!viewString) return 0;
    if (typeof viewString === 'number') return viewString;
    
    const str = viewString.toString().toLowerCase().replace(/,/g, '');
    
    // Handle "1.2M views", "500K views", etc.
    const multipliers: Record<string, number> = {
        'k': 1000,
        'm': 1000000,
        'b': 1000000000
    };
    
    for (const [suffix, multiplier] of Object.entries(multipliers)) {
        if (str.includes(suffix)) {
            const num = parseFloat(str.replace(/[^0-9.]/g, ''));
            return Math.round(num * multiplier);
        }
    }
    
    return parseInt(str.replace(/[^0-9]/g, '')) || 0;
}

function parseDuration(durationString: string | undefined): string {
    if (!durationString) return '';
    
    // Already formatted like "10:30" or "1:05:30"
    if (/^\d+:\d{2}(:\d{2})?$/.test(durationString)) {
        return durationString;
    }
    
    // Handle ISO 8601 duration (PT10M30S)
    const isoMatch = durationString.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (isoMatch) {
        const hours = parseInt(isoMatch[1] || '0');
        const minutes = parseInt(isoMatch[2] || '0');
        const seconds = parseInt(isoMatch[3] || '0');
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    return durationString;
}

function calculateRelevanceScore(
    video: any,
    searchQuery: string,
    options: YouTubeSearchOptions
): number {
    let score = 50; // Base score
    
    const title = (video.title || '').toLowerCase();
    const channel = (video.channel || '').toLowerCase();
    const queryWords = searchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
    // Title relevance (up to +30)
    const titleMatches = queryWords.filter(word => title.includes(word)).length;
    score += Math.min(30, (titleMatches / queryWords.length) * 30);
    
    // View count bonus (up to +15)
    const views = parseViewCount(video.views);
    if (views >= 1000000) score += 15;
    else if (views >= 500000) score += 12;
    else if (views >= 100000) score += 10;
    else if (views >= 50000) score += 7;
    else if (views >= 10000) score += 5;
    
    // Preferred channel bonus (+10)
    if (options.preferredChannels?.some(c => channel.includes(c.toLowerCase()))) {
        score += 10;
    }
    
    // Excluded channel penalty (-50)
    if (options.excludeChannels?.some(c => channel.includes(c.toLowerCase()))) {
        score -= 50;
    }
    
    // Tutorial/guide bonus (+5)
    const tutorialKeywords = ['tutorial', 'guide', 'how to', 'explained', 'complete', 'full'];
    if (tutorialKeywords.some(kw => title.includes(kw))) {
        score += 5;
    }
    
    // Recency bonus (videos from last year get +5)
    if (video.date) {
        const videoDate = new Date(video.date);
        const daysSincePublished = (Date.now() - videoDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSincePublished < 365) score += 5;
        if (daysSincePublished < 180) score += 3;
    }
    
    return Math.max(0, Math.min(100, Math.round(score)));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔍 MAIN SEARCH FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export async function searchYouTubeVideo(
    topic: string,
    serperApiKey: string,
    options: YouTubeSearchOptions = {},
    log?: (msg: string) => void
): Promise<YouTubeSearchResult> {
    const startTime = Date.now();
    
    const {
        minViews = 10000,
        maxAgeDays = 730, // 2 years
        maxResults = 10,
        language = 'en',
        country = 'us'
    } = options;
    
    log?.(`🎬 Searching YouTube for: "${topic.substring(0, 50)}..."`);
    
    // Build optimized search queries
    const searchQueries = [
        `${topic} tutorial guide`,
        `${topic} explained`,
        `${topic} complete guide ${new Date().getFullYear()}`,
    ];
    
    const allVideos: YouTubeVideoData[] = [];
    
    for (const query of searchQueries) {
        try {
            log?.(`   → Searching: "${query.substring(0, 40)}..."`);
            
            const response = await fetch('https://google.serper.dev/videos', {
                method: 'POST',
                headers: {
                    'X-API-KEY': serperApiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    q: query,
                    gl: country,
                    hl: language,
                    num: maxResults
                })
            });
            
            if (!response.ok) {
                log?.(`   ⚠️ Serper API error: ${response.status}`);
                continue;
            }
            
            const data = await response.json();
            const videos = data.videos || [];
            
            log?.(`   → Found ${videos.length} videos`);
            
            for (const video of videos) {
                // Must be YouTube
                if (!video.link?.includes('youtube.com') && !video.link?.includes('youtu.be')) {
                    continue;
                }
                
                const videoId = extractYouTubeVideoId(video.link);
                if (!videoId) continue;
                
                // Check if already found
                if (allVideos.some(v => v.videoId === videoId)) continue;
                
                const views = parseViewCount(video.views);
                
                // Filter by minimum views
                if (views < minViews) {
                    continue;
                }
                
                // Filter by age if date available
                if (video.date && maxAgeDays) {
                    const videoDate = new Date(video.date);
                    const daysSincePublished = (Date.now() - videoDate.getTime()) / (1000 * 60 * 60 * 24);
                    if (daysSincePublished > maxAgeDays) {
                        continue;
                    }
                }
                
                const relevanceScore = calculateRelevanceScore(video, topic, options);
                
                const videoData: YouTubeVideoData = {
                    videoId,
                    title: video.title || 'Video',
                    channel: video.channel || 'Unknown Channel',
                    channelUrl: video.channelUrl,
                    views,
                    duration: parseDuration(video.duration),
                    thumbnailUrl: video.imageUrl || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                    embedUrl: `https://www.youtube.com/embed/${videoId}`,
                    publishedAt: video.date,
                    description: video.snippet,
                    relevanceScore
                };
                
                allVideos.push(videoData);
            }
            
            // If we have enough good videos, stop searching
            const goodVideos = allVideos.filter(v => v.relevanceScore >= 60);
            if (goodVideos.length >= 3) break;
            
        } catch (error: any) {
            log?.(`   ⚠️ Search error: ${error.message}`);
        }
        
        // Small delay between queries
        await new Promise(r => setTimeout(r, 200));
    }
    
    // Sort by relevance score
    allVideos.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    const searchTime = Date.now() - startTime;
    
    if (allVideos.length === 0) {
        log?.(`   ⚠️ No suitable YouTube videos found`);
        return {
            video: null,
            alternativeVideos: [],
            searchQuery: topic,
            source: 'serper',
            searchTime
        };
    }
    
    const bestVideo = allVideos[0];
    const alternatives = allVideos.slice(1, 4);
    
    log?.(`   ✅ Best match: "${bestVideo.title.substring(0, 50)}..."`);
    log?.(`   📊 ${bestVideo.channel} • ${bestVideo.views.toLocaleString()} views • Score: ${bestVideo.relevanceScore}/100`);
    
    if (alternatives.length > 0) {
        log?.(`   📋 ${alternatives.length} alternative videos found`);
    }
    
    return {
        video: bestVideo,
        alternativeVideos: alternatives,
        searchQuery: topic,
        source: 'serper',
        searchTime
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 GENERATE BEAUTIFUL YOUTUBE EMBED HTML
// ═══════════════════════════════════════════════════════════════════════════════

export function generateYouTubeEmbed(
    video: YouTubeVideoData,
    options: {
        showHeader?: boolean;
        showStats?: boolean;
        lazyLoad?: boolean;
        title?: string;
    } = {}
): string {
    const {
        showHeader = true,
        showStats = true,
        lazyLoad = true,
        title = 'Watch: Video Guide'
    } = options;
    
    const escapeHtml = (str: string): string => {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };
    
    const formatViews = (views: number): string => {
        if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
        if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
        return views.toString();
    };
    
    return `
<!-- YouTube Video: ${escapeHtml(video.title)} -->
<div class="wpo-youtube-embed" style="
    margin: 40px 0;
">
    <div style="
        border: 1px solid rgba(128, 128, 128, 0.15);
        border-radius: 16px;
        overflow: hidden;
        background: rgba(128, 128, 128, 0.03);
    ">
        ${showHeader ? `
        <!-- Video Header -->
        <div style="
            padding: 16px 20px;
            border-bottom: 1px solid rgba(128, 128, 128, 0.1);
            display: flex;
            align-items: center;
            gap: 14px;
        ">
            <div style="
                width: 44px;
                height: 44px;
                background: linear-gradient(135deg, #ff0000 0%, #cc0000 100%);
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            ">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M8 5v14l11-7z"/>
                </svg>
            </div>
            <div style="flex: 1; min-width: 0;">
                <div style="
                    font-size: 15px;
                    font-weight: 600;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    margin-bottom: 2px;
                ">${escapeHtml(video.title)}</div>
                <div style="
                    font-size: 12px;
                    opacity: 0.6;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: wrap;
                ">
                    <span>${escapeHtml(video.channel)}</span>
                    ${showStats ? `
                    <span style="opacity: 0.4;">•</span>
                    <span>${formatViews(video.views)} views</span>
                    ${video.duration ? `
                    <span style="opacity: 0.4;">•</span>
                    <span>${video.duration}</span>
                    ` : ''}
                    ` : ''}
                </div>
            </div>
        </div>
        ` : ''}
        
        <!-- Video Player -->
        <div style="
            position: relative;
            padding-bottom: 56.25%;
            height: 0;
            background: #000;
        ">
            <iframe 
                style="
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    border: none;
                "
                src="${video.embedUrl}?rel=0&modestbranding=1"
                title="${escapeHtml(video.title)}"
                ${lazyLoad ? 'loading="lazy"' : ''}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowfullscreen
            ></iframe>
        </div>
        
        <!-- Video Footer (optional description) -->
        ${video.description ? `
        <div style="
            padding: 14px 20px;
            border-top: 1px solid rgba(128, 128, 128, 0.1);
            font-size: 13px;
            line-height: 1.6;
            opacity: 0.7;
        ">
            ${escapeHtml(video.description.substring(0, 200))}${video.description.length > 200 ? '...' : ''}
        </div>
        ` : ''}
    </div>
</div>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎬 GENERATE COMPACT YOUTUBE EMBED (For Sidebars/Cards)
// ═══════════════════════════════════════════════════════════════════════════════

export function generateCompactYouTubeEmbed(video: YouTubeVideoData): string {
    const escapeHtml = (str: string): string => {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    };
    
    return `
<div style="
    border: 1px solid rgba(128, 128, 128, 0.15);
    border-radius: 12px;
    overflow: hidden;
    margin: 24px 0;
">
    <a href="https://www.youtube.com/watch?v=${video.videoId}" 
       target="_blank" 
       rel="noopener noreferrer"
       style="
           display: flex;
           align-items: center;
           gap: 14px;
           padding: 14px;
           text-decoration: none;
           color: inherit;
           transition: background 0.2s;
       "
    >
        <div style="
            position: relative;
            width: 120px;
            height: 68px;
            flex-shrink: 0;
            border-radius: 8px;
            overflow: hidden;
            background: #000;
        ">
            <img 
                src="${video.thumbnailUrl}" 
                alt="${escapeHtml(video.title)}"
                style="width: 100%; height: 100%; object-fit: cover;"
                loading="lazy"
            />
            <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 36px;
                height: 36px;
                background: rgba(255, 0, 0, 0.9);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            ">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                    <path d="M8 5v14l11-7z"/>
                </svg>
            </div>
            ${video.duration ? `
            <div style="
                position: absolute;
                bottom: 4px;
                right: 4px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                font-size: 10px;
                font-weight: 600;
                padding: 2px 6px;
                border-radius: 4px;
            ">${video.duration}</div>
            ` : ''}
        </div>
        <div style="flex: 1; min-width: 0;">
            <div style="
                font-size: 14px;
                font-weight: 600;
                line-height: 1.3;
                margin-bottom: 4px;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            ">${escapeHtml(video.title)}</div>
            <div style="
                font-size: 11px;
                opacity: 0.6;
            ">${escapeHtml(video.channel)} • ${video.views.toLocaleString()} views</div>
        </div>
    </a>
</div>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default {
    YOUTUBE_SERVICE_VERSION,
    searchYouTubeVideo,
    generateYouTubeEmbed,
    generateCompactYouTubeEmbed,
    extractYouTubeVideoId,
    parseViewCount
};
