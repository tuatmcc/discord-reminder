import { FormatOptions, ParseISOOptions, format, parse, parseISO } from "date-fns";
import { Locale } from "discord-api-types/v10";
import ja from "date-fns/locale/ja";

export function getApplicationId(token: string) {
    const [base64Id] = token.split('.');
    return atob(base64Id);
}

export function formatDateToString(date: Date) {
    return format(date, 'yyyy-MM-dd', {timeZone: 'Asia/Tokyo'} as FormatOptions) + 'T' + format(date, 'HH:mm');
}

export function checkValidStringAsDate(str: string){
    return parseISO(str, {timeZone: 'Asia/Tokyo'} as ParseISOOptions).toString() !== 'Invalid Date';
}