import { describe, expect, it } from 'vitest';
import { instagramProblems, youtubeProblems } from '../src/project/posts.js';

const messages = (ps: { message: string }[]) => ps.map((p) => p.message).join('\n');

const GOOD_YT = `बंदर और मगरमच्छ | The Monkey and the Crocodile

जामुन के पेड़ वाला बंदर और नदी का मगरमच्छ पक्के दोस्त थे। पर मगरमच्छ की पत्नी को चाहिए था बंदर का कलेजा!

A monkey in a jamun tree and a river crocodile were the best of friends.

Chapters
0:00 दोस्ती
0:40 कलेजा
1:30 चतुराई

#पंचतंत्र #HindiStories #KidsStories`;

describe('youtube.txt', () => {
  it('passes a plain title and description', () => {
    expect(youtubeProblems(GOOD_YT, 200)).toEqual([]);
  });

  it('flags the Markdown that YouTube shows as typed', () => {
    const md = GOOD_YT.replace('Chapters', '## Chapters').replace('A monkey', '**A monkey**');
    const m = messages(youtubeProblems(md, 200));
    expect(m).toMatch(/bold markers/);
    expect(m).toMatch(/Markdown heading/);
    expect(messages(youtubeProblems('**Title**\n\nPlain.', 200))).toMatch(/bold markers/);
  });

  it('notices a line whose first letter was lost in pasting', () => {
    const lost = GOOD_YT.replace('जामुन', 'ामुन');
    expect(messages(youtubeProblems(lost, 200))).toMatch(/line 3 starts on a vowel sign/);
  });

  it('notices prose wrapped at a fixed width', () => {
    const wrapped = GOOD_YT.replace(
      'A monkey in a jamun tree and',
      'A monkey in a jamun tree and\na'
    );
    expect(messages(youtubeProblems(wrapped, 200))).toMatch(/line 5 breaks mid-sentence/);
  });

  it('notices repeated hashtags', () => {
    expect(messages(youtubeProblems(GOOD_YT + ' #kidsstories', 200))).toMatch(
      /repeats #kidsstories/
    );
  });

  it('wants a blank line after the title and a title YouTube accepts', () => {
    const p = youtubeProblems(GOOD_YT.replace('\n\n', '\n'), 200);
    expect(messages(p)).toMatch(/blank line after the title/);
    expect(messages(youtubeProblems('x'.repeat(101) + '\n\nbody.', 200))).toMatch(/101 characters/);
    expect(messages(youtubeProblems('a <b>\n\nbody.', 200))).toMatch(/< and >/);
  });

  it('checks the chapter marks the way YouTube does', () => {
    const late = GOOD_YT.replace('0:00', '0:05');
    expect(messages(youtubeProblems(late, 200))).toMatch(/must be 0:00/);
    const close = GOOD_YT.replace('0:40', '0:05');
    expect(messages(youtubeProblems(close, 200))).toMatch(/5 s after the one before/);
    expect(messages(youtubeProblems(GOOD_YT, 60))).toMatch(/past the end/);
  });
});

describe('instagram.txt', () => {
  const GOOD_IG = `बंदर और मगरमच्छ पक्के दोस्त थे!

पूरी कहानी YouTube पर / Full story on YouTube: @channel

#पंचतंत्र #HindiStories #Reels`;

  it('passes a plain caption', () => {
    expect(instagramProblems(GOOD_IG)).toEqual([]);
  });

  it('keeps YouTube-only things out', () => {
    const m = messages(instagramProblems(GOOD_IG + ' #Shorts\n0:00 start'));
    expect(m).toMatch(/#Shorts/);
    expect(m).toMatch(/chapter timestamps/);
  });

  it('holds to the caption limits', () => {
    expect(messages(instagramProblems('क'.repeat(2201)))).toMatch(/2201 characters/);
    const tags = Array.from({ length: 31 }, (_, i) => `#t${i}`).join(' ');
    expect(messages(instagramProblems(tags))).toMatch(/31 hashtags/);
  });
});
