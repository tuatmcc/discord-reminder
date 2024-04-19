import { load } from 'cheerio';
import { ParseOptions, parse } from 'date-fns';
import { Contest } from '../types/contest';

const ATCODER_CONTESTS_URL = 'https://atcoder.jp/contests/';

export async function getFutureContests() {
    let contests: Contest[] = [];
    const response = await fetch(ATCODER_CONTESTS_URL);
    const html = await response.text();
    const $ = load(html);
    const futureContestsTableRows = $('#contest-table-upcoming > div > div > table > tbody > tr');
    for (let i = 1; i <= futureContestsTableRows.length; i++) {
        const row = $(`#contest-table-upcoming > div > div > table > tbody > tr:nth-child(${i})`);
        const dateStr = row.find('td:nth-child(1) > a').text();
        const contestId = row.find('td:nth-child(2) > a').attr('href')?.substring(10);
        const contestName = row.find('td:nth-child(2) > a').text();
        const date = parse(dateStr, 'yyyy-MM-dd HH:mm:ss+0900', new Date(), { timeZone: 'Asia/Tokyo' } as ParseOptions);
        contests.push({ id: contestId, name: contestName, url: ATCODER_CONTESTS_URL + contestId, time: date } as Contest);
    }
    return contests;
}
