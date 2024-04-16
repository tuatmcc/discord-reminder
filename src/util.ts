import { FormatOptions, ParseOptions, format, parse } from 'date-fns';

export function getApplicationId(token: string) {
    const [base64Id] = token.split('.');
    return atob(base64Id);
}

const dateFormatString = "yyyy-MM-dd'T'HH:mm";

export function formatDateToString(date: Date) {
    return format(date, dateFormatString, { timeZone: 'Asia/Tokyo' } as FormatOptions);
}

type parseResult =
    | {
          success: true;
          date: Date;
      }
    | {
          success: false;
      };

export function parseStringToDate(str: string) {
    const currentDate = new Date();
    {
        const result = parse(str, dateFormatString, currentDate, { timeZone: 'Asia/Tokyo' } as ParseOptions);
        if (result.toString() !== 'Invalid Date') return { success: true, date: result } as parseResult;
    }
    const currentYear = format(currentDate, 'yyyy', { timeZone: 'Asia/Tokyo' } as FormatOptions);
    const nextYear = (parseInt(currentYear) + 1).toString();
    {
        const result = parse(`${currentYear}-${str}`, dateFormatString, currentDate, { timeZone: 'Asia/Tokyo' } as ParseOptions);
        if (result.toString() !== 'Invalid Date' && result > currentDate) return { success: true, date: result } as parseResult;
    }
    {
        const result = parse(`${nextYear}-${str}`, dateFormatString, currentDate, { timeZone: 'Asia/Tokyo' } as ParseOptions);
        if (result.toString() !== 'Invalid Date') return { success: true, date: result } as parseResult;
    }
    return { success: false } as parseResult;
}
