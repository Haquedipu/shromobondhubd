import React from 'react';

// FIX: Changed icon components to accept a single `props` object instead of destructuring.
// This fixes a type inference issue where standard SVG attributes like 'title' were not being recognized.
// FIX: Added 'title' prop to IconProps and implemented it as an accessible <title> element inside the SVG. This resolves the error in App.tsx.
type IconProps = React.SVGProps<SVGSVGElement> & { title?: string };

export const ArrowLeftIcon = ({ title, ...props }: IconProps) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" className={props.className || "h-6 w-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    {title && <title>{title}</title>}
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

export const ArrowRightIcon = ({ title, ...props }: IconProps) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" className={props.className || "h-6 w-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    {title && <title>{title}</title>}
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

export const ArrowUpIcon = ({ title, ...props }: IconProps) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" className={props.className || "h-6 w-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {title && <title>{title}</title>}
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
);

export const BookOpenIcon = ({ title, ...props }: IconProps) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" className={props.className || "h-6 w-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {title && <title>{title}</title>}
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
);

export const BookmarkIcon = ({ filled = false, title, ...props }: IconProps & { filled?: boolean }) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" className={props.className || "h-6 w-6"} fill={filled ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {title && <title>{title}</title>}
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
);

export const ChatBubbleIcon = ({ title, ...props }: IconProps) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" className={props.className || "h-6 w-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {title && <title>{title}</title>}
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
);

export const CheckIcon = ({ title, ...props }: IconProps) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    className={props.className || "h-6 w-6"}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    {title && <title>{title}</title>}
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

export const ChevronDownIcon = ({ title, ...props }: IconProps) => (
    <svg 
        {...props}
        xmlns="http://www.w3.org/2000/svg" 
        className={props.className || "h-6 w-6"} 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor" 
        strokeWidth={2}>
        {title && <title>{title}</title>}
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
);

export const CrownIcon = ({ title, ...props }: IconProps) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" className={props.className || "h-5 w-5"} viewBox="0 0 20 20" fill="currentColor">
      {title && <title>{title}</title>}
      <path d="M5 18a2 2 0 002 2h6a2 2 0 002-2V8a2 2 0 00-2-2h-1.333a1.996 1.996 0 01-1.414-.586l-.833-.833a2 2 0 00-2.828 0l-.833.833a1.996 1.996 0 01-1.414.586H5a2 2 0 00-2 2v10zM10 12a2 2 0 100-4 2 2 0 000 4z" />
    </svg>
);

export const FireIcon = ({ title, ...props }: IconProps) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" className={props.className || "h-6 w-6"} viewBox="0 0 20 20" fill="currentColor">
      {title && <title>{title}</title>}
      <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.12l-2.495 4.542a1 1 0 00.22 1.253l1.24 1.24a1 1 0 001.414 0l4.243-4.242a1 1 0 000-1.414l-1.24-1.24a1 1 0 00-1.21-.08z" clipRule="evenodd" />
      <path fillRule="evenodd" d="M3.242 11.242a1 1 0 000 1.414l3.182 3.182a1 1 0 001.414 0l3.182-3.182a1 1 0 00-1.414-1.414l-1.07 1.07-1.071-1.071a1 1 0 00-1.414 0z" clipRule="evenodd" />
    </svg>
);

export const FlipHorizontalIcon = ({ title, ...props }: IconProps) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" className={props.className || "h-6 w-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {title && <title>{title}</title>}
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16l4-4m0 0l-4-4m4 4H4m14 8v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    </svg>
);

export const MenuIcon = ({ title, ...props }: IconProps) => (
    <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        className={props.className || "h-6 w-6"}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
    >
        {title && <title>{title}</title>}
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
);

export const ModernChatIcon = ({ title, ...props }: IconProps) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" className={props.className || "h-6 w-6"} fill="currentColor" viewBox="0 0 24 24">
        {title && <title>{title}</title>}
        <path d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V4c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z"/>
    </svg>
);

export const MoonIcon = ({ title, ...props }: IconProps) => (
    <svg 
        {...props}
        xmlns="http://www.w3.org/2000/svg" 
        className={props.className || "h-6 w-6"} 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor" 
        strokeWidth={2}>
        {title && <title>{title}</title>}
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
);

export const PaperAirplaneIcon = ({ title, ...props }: IconProps) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" className={props.className || "h-6 w-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {title && <title>{title}</title>}
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
);

export const PencilIcon = ({ title, ...props }: IconProps) => (
    <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        className={props.className || "h-5 w-5"}
        viewBox="0 0 20 20"
        fill="currentColor"
    >
        {title && <title>{title}</title>}
        <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
        <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
    </svg>
);

export const SearchIcon = ({ title, ...props }: IconProps) => (
    <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        className={props.className || "h-6 w-6"}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
    >
        {title && <title>{title}</title>}
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

export const ShareIcon = ({ title, ...props }: IconProps) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" className={props.className || "h-6 w-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {title && <title>{title}</title>}
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6.002l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.367a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
    </svg>
);

export const StarIcon = ({ title, ...props }: IconProps) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    className={props.className || "h-6 w-6"}
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    {title && <title>{title}</title>}
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

export const SunIcon = ({ title, ...props }: IconProps) => (
    <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        className={props.className || "h-6 w-6"}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
    >
        {title && <title>{title}</title>}
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M12 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
);

export const TrophyIcon = ({ title, ...props }: IconProps) => (
    <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        className={props.className || "h-6 w-6"}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
    >
        {title && <title>{title}</title>}
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-3-5v5m-3-2v2m-2 4h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v11a2 2 0 002 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 8V6a2 2 0 012-2h2a2 2 0 012 2v2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01" />
    </svg>
);

export const UserIcon = ({ title, ...props }: IconProps) => (
    <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        className={props.className || "h-6 w-6"}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
    >
        {title && <title>{title}</title>}
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);

export const XIcon = ({ title, ...props }: IconProps) => (
    <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        className={props.className || "h-6 w-6"}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
    >
        {title && <title>{title}</title>}
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);