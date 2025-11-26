import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
// FIX: Imported `FuseResultMatch` directly from `fuse.js` to resolve the namespace error with `FuseResult.Match`.
import Fuse, { FuseResult, FuseResultMatch } from 'fuse.js';
import { GoogleGenAI, Chat } from '@google/genai';
import { LawSectionData, Badge as BadgeType, QuizType, Chapter, Flashcard, Question, Ratings } from './types';
import { lawSections, badges, chapters, leaderboardData, glossaryTerms, GlossaryTerm } from './constants';
import { CheckIcon, XIcon, StarIcon, SunIcon, MoonIcon, SearchIcon, UserIcon, TrophyIcon, PencilIcon, FireIcon, CrownIcon, FlipHorizontalIcon, ArrowLeftIcon, ArrowRightIcon, ChevronDownIcon, MenuIcon, BookmarkIcon, ShareIcon, ArrowUpIcon, PaperAirplaneIcon, BookOpenIcon, ModernChatIcon } from './components/icons';

// --- Custom Hooks ---

const useDarkMode = (): [string, () => void] => {
    const [theme, setTheme] = useState(() => {
        if (typeof window !== 'undefined') {
            const savedTheme = window.localStorage.getItem('theme');
            if (savedTheme) return savedTheme;
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return 'light';
    });

    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        window.localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    return [theme, toggleTheme];
};

const useBookmarks = (): [number[], (id: number) => void] => {
    const [bookmarks, setBookmarks] = useState<number[]>(() => {
        try {
            const item = window.localStorage.getItem('bookmarkedSections');
            return item ? JSON.parse(item) : [];
        // FIX: Wrapped the catch block logic in curly braces. A catch clause without braces can only contain one statement, but this one had two, which is a syntax error. This fix also resolves the "Cannot find name 'error'" error.
        } catch (error) {
            console.error("Error reading bookmarks from localStorage", error);
            return [];
        }
    });

    useEffect(() => {
        try {
            window.localStorage.setItem('bookmarkedSections', JSON.stringify(bookmarks));
        } catch (error) {
            console.error("Error saving bookmarks to localStorage", error);
        }
    }, [bookmarks]);

    const toggleBookmark = (id: number) => {
        setBookmarks(prev =>
            prev.includes(id) ? prev.filter(bId => bId !== id) : [...prev, id]
        );
    };

    // FIX: Added the missing return statement. The function signature requires a tuple to be returned, but the function was ending without returning a value. This fixes the error on line 38.
    return [bookmarks, toggleBookmark];
};

const useRatings = (): [Ratings, (id: number, rating: number) => void] => {
    const [ratings, setRatings] = useState<Ratings>(() => {
        try {
            const item = window.localStorage.getItem('lawSectionRatings');
            return item ? JSON.parse(item) : {};
        } catch (error) {
            console.error("Error reading ratings from localStorage", error);
            return {};
        }
    });

    useEffect(() => {
        try {
            window.localStorage.setItem('lawSectionRatings', JSON.stringify(ratings));
        } catch (error) {
            console.error("Error saving ratings to localStorage", error);
        }
    }, [ratings]);

    const addRating = (id: number, rating: number) => {
        setRatings(prev => {
            const currentRatings = prev[id] || [];
            return { ...prev, [id]: [...currentRatings, rating] };
        });
    };

    return [ratings, addRating];
};

const useRatedSections = (): [number[], (id: number) => void] => {
    const [rated, setRated] = useState<number[]>(() => {
        try {
            const item = window.localStorage.getItem('ratedSections');
            return item ? JSON.parse(item) : [];
        } catch (error) {
            console.error("Error reading rated sections from localStorage", error);
            return [];
        }
    });

    useEffect(() => {
        try {
            window.localStorage.setItem('ratedSections', JSON.stringify(rated));
        } catch (error) {
            console.error("Error saving rated sections to localStorage", error);
        }
    }, [rated]);

    const markAsRated = (id: number) => {
        setRated(prev => {
            if (prev.includes(id)) return prev;
            return [...prev, id];
        });
    };

    return [rated, markAsRated];
};

const useUserScore = (): [number, (points: number) => void] => {
    const [score, setScore] = useState<number>(() => {
        try {
            const item = window.localStorage.getItem('userTotalScore');
            return item ? parseInt(item, 10) : 0;
        } catch (error) {
            console.error("Error reading score from localStorage", error);
            return 0;
        }
    });

    useEffect(() => {
        try {
            window.localStorage.setItem('userTotalScore', String(score));
        } catch (error) {
            console.error("Error saving score to localStorage", error);
        }
    }, [score]);

    const addUserScore = (points: number) => {
        if (points > 0) {
            setScore(prev => prev + points);
        }
    };

    return [score, addUserScore];
};

// --- Helper Components ---
const mergeIndices = (indices: readonly [number, number][]): [number, number][] => {
    if (!indices || indices.length < 2) return indices ? indices.map(i => [...i] as [number, number]) : [];

    const sorted = [...indices].sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];

    if (sorted.length > 0) {
        merged.push([...sorted[0]] as [number, number]);
        for (let i = 1; i < sorted.length; i++) {
            const current = sorted[i];
            const last = merged[merged.length - 1];
            if (current[0] <= last[1] + 1) { // Overlap or adjacent
                last[1] = Math.max(last[1], current[1]);
            } else {
                merged.push([...current] as [number, number]);
            }
        }
    }
    return merged;
};

// Helper component for highlighting text based on Fuse.js matches
const HighlightedText: React.FC<{ text: string; indices: readonly [number, number][] | undefined; className: string }> = ({ text, indices, className }) => {
    if (!indices || indices.length === 0) {
        return <>{text}</>;
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    const mergedIndices = mergeIndices(indices);

    mergedIndices.forEach(([start, end], i) => {
        if (start > lastIndex) {
            parts.push(text.substring(lastIndex, start));
        }
        parts.push(
            <mark key={`match-${i}`} className={className}>
                {text.substring(start, end + 1)}
            </mark>
        );
        lastIndex = end + 1;
    });

    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }

    return <>{parts.map((part, i) => <React.Fragment key={i}>{part}</React.Fragment>)}</>;
};

const StarRating: React.FC<{
    count?: number;
    rating: number;
    onRatingChange: (rating: number) => void;
    size?: string;
}> = ({ count = 5, rating, onRatingChange, size = "h-8 w-8" }) => {
    const [hoverRating, setHoverRating] = useState(0);

    return (
        <div className="flex items-center justify-center gap-1">
            {[...Array(count)].map((_, index) => {
                const ratingValue = index + 1;
                return (
                    <button
                        key={index}
                        onClick={() => onRatingChange(ratingValue)}
                        onMouseEnter={() => setHoverRating(ratingValue)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded-full"
                        aria-label={`Rate ${ratingValue} out of ${count}`}
                    >
                        <StarIcon
                            className={`${size} transition-colors ${
                                ratingValue <= (hoverRating || rating)
                                    ? "text-amber-400"
                                    : "text-gray-300 dark:text-gray-600"
                            }`}
                            title={`${ratingValue} star rating`}
                        />
                    </button>
                );
            })}
        </div>
    );
};

const AverageRating: React.FC<{ ratings: number[] | undefined, showText?: boolean }> = ({ ratings, showText = true }) => {
    if (!ratings || ratings.length === 0) {
        return <div className="text-xs text-gray-500">{showText ? 'এখনো কোনো রেটিং নেই' : ''}</div>;
    }

    const average = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    const displayStars = Math.round(average);

    return (
        <div className="flex items-center gap-1">
            <div className="flex">
                {[...Array(5)].map((_, i) => (
                    <StarIcon
                        key={i}
                        className={`h-4 w-4 ${i < displayStars ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'}`}
                        title={`Average rating: ${average.toFixed(1)} out of 5`}
                    />
                ))}
            </div>
            {showText && <span className="text-xs text-gray-600 dark:text-gray-400 ml-1">
                {average.toFixed(1)} ({ratings.length}টি রেটিং)
            </span>}
        </div>
    );
};

interface SearchResultsProps {
    results: FuseResult<LawSectionData>[];
    query: string;
    onSelectSection: (section: LawSectionData, shouldScroll?: boolean) => void;
    chapters: Chapter[];
    filterChapterId: string;
    onFilterChange: (chapterId: string) => void;
    highlightedIndex: number;
    onHighlightIndex: (index: number) => void;
    ratings: Ratings;
}

// FIX: Replaced `FuseResult.Match` with `FuseResultMatch` to align with the corrected import.
const createDescriptionSnippet = (item: LawSectionData, matches: readonly FuseResultMatch[] | undefined): React.ReactNode => {
    if (!matches) {
        return item.summary;
    }
    
    const summaryMatch = matches.find(m => m.key === 'summary');
    if (summaryMatch) {
        return <HighlightedText text={item.summary} indices={summaryMatch.indices} className="bg-yellow-300 dark:bg-yellow-500 dark:text-gray-900 rounded px-0.5" />;
    }

    const fullTextMatch = matches.find(m => m.key === 'fullText');
    if (fullTextMatch && item.fullText && fullTextMatch.indices.length > 0) {
        const fullText = item.fullText;
        const indices = fullTextMatch.indices;
        const firstMatchStart = indices[0][0];

        const snippetRadiusBefore = 40;
        const snippetTotalLength = 120;
        
        let snippetStart = Math.max(0, firstMatchStart - snippetRadiusBefore);
        let snippetEnd = Math.min(fullText.length, snippetStart + snippetTotalLength);
        
        if (snippetEnd === fullText.length) {
            snippetStart = Math.max(0, snippetEnd - snippetTotalLength);
        }

        const rawSnippetText = fullText.substring(snippetStart, snippetEnd).replace(/\n/g, ' ');
        
        const prefix = snippetStart > 0 ? '... ' : '';
        const suffix = snippetEnd < fullText.length ? ' ...' : '';
        const finalSnippetText = prefix + rawSnippetText + suffix;

        const offset = prefix.length - snippetStart;
        const adjustedIndices = indices
            .map(([start, end]) => [start + offset, end + offset] as [number, number])
            .filter(([start, end]) => start >= prefix.length && end < finalSnippetText.length - suffix.length);

        if (adjustedIndices.length > 0) {
             return <HighlightedText text={finalSnippetText} indices={adjustedIndices} className="bg-yellow-300 dark:bg-yellow-500 dark:text-gray-900 rounded px-0.5" />;
        }
    }

    return item.summary;
};


const SearchResults: React.FC<SearchResultsProps> = ({ results, query, onSelectSection, chapters, filterChapterId, onFilterChange, highlightedIndex, onHighlightIndex, ratings }) => {
    const highlightedRef = useRef<HTMLLIElement>(null);

    useEffect(() => {
        highlightedRef.current?.scrollIntoView({ block: 'nearest' });
    }, [highlightedIndex]);

    if (!query) return null;

    return (
        <div className="absolute top-full mt-2 w-full bg-white dark:bg-gray-800 rounded-lg shadow-2xl border dark:border-gray-700 z-30 animate-fade-in">
            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 border-b dark:border-gray-700">
                <div className="flex items-center gap-2">
                    <label htmlFor="chapter-filter" className="text-sm font-medium text-gray-600 dark:text-gray-400 flex-shrink-0">ফিল্টার:</label>
                    <select
                        id="chapter-filter"
                        value={filterChapterId}
                        onChange={(e) => onFilterChange(e.target.value)}
                        className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                        <option value="all">সকল অধ্যায়</option>
                        {chapters.filter(c => c.sections.length > 0).map(chapter => (
                            <option key={chapter.id} value={chapter.id}>
                                {chapter.title}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            {results.length > 0 ? (
                <ul id="search-results-listbox" role="listbox" className="max-h-96 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700">
                    {results.map(({ item, matches }, index) => {
                        const titleIndices = matches?.filter(m => m.key === 'title' || m.key === 'sectionNumber').flatMap(m => m.indices) || [];
                        const isHighlighted = index === highlightedIndex;

                        const descriptionSnippet = createDescriptionSnippet(item, matches);
                        
                        return (
                            <li 
                                key={item.id} 
                                id={`search-result-${index}`}
                                role="option"
                                aria-selected={isHighlighted}
                                ref={isHighlighted ? highlightedRef : null}
                                onMouseEnter={() => onHighlightIndex(index)}
                            >
                                <button
                                    onClick={() => onSelectSection(item, true)}
                                    className={`group w-full flex justify-between items-center p-4 text-left transition-colors duration-200 focus:outline-none ${isHighlighted ? 'bg-emerald-50 dark:bg-gray-700' : 'hover:bg-emerald-50 dark:hover:bg-gray-700'}`}
                                    aria-label={`'${item.title}' এর বিস্তারিত দেখুন`}
                                >
                                    <div className="flex-grow pr-4">
                                        <div className="font-bold text-emerald-600 dark:text-emerald-400">
                                            <HighlightedText text={`${item.sectionNumber}: ${item.title}`} indices={titleIndices} className="bg-emerald-200 dark:bg-emerald-700/80 dark:text-emerald-50 rounded px-0.5" />
                                        </div>
                                        <div className="mt-1">
                                            <AverageRating ratings={ratings[item.id]} showText={false} />
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 dark:group-hover:text-gray-300 mt-1 line-clamp-2">
                                            {descriptionSnippet}
                                        </p>
                                    </div>
                                    <div className="ml-auto flex-shrink-0">
                                        <div 
                                            className="bg-emerald-100 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200 text-sm font-semibold px-4 py-2 rounded-lg transition-all duration-200 shadow-sm group-hover:bg-emerald-200 dark:group-hover:bg-emerald-700 group-hover:scale-105 group-hover:shadow-md"
                                            aria-hidden="true"
                                        >
                                            ধারা দেখুন
                                        </div>
                                    </div>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <div className="p-4 text-center text-gray-500">
                    কোন ফলাফল পাওয়া যায়নি।
                </div>
            )}
        </div>
    );
};

const QuizIntro: React.FC<{ section: LawSectionData; onStartQuiz: () => void; onBackToDetails: () => void }> = ({ section, onStartQuiz, onBackToDetails }) => {
    const totalPoints = useMemo(() => section.quiz.reduce((sum, q) => sum + q.points, 0), [section.quiz]);

    return (
        <div className="p-4 md:p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg text-center animate-pop-in">
            <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mb-2">কুইজ: {section.title}</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">এই ধারা সম্পর্কে আপনার জ্ঞান পরীক্ষা করুন এবং পয়েন্ট অর্জন করুন।</p>
            <div className="my-6">
                <span className="text-lg font-semibold">মোট পয়েন্ট: </span>
                <span className="text-2xl font-bold text-emerald-500">{totalPoints}</span>
            </div>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                 <button
                    onClick={onStartQuiz}
                    className="w-full sm:w-auto bg-emerald-700 text-white font-bold py-3 px-8 rounded-lg hover:bg-emerald-800 transition-transform transform hover:scale-105 shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 dark:focus:ring-offset-gray-800"
                    aria-label="কুইজ শুরু করুন"
                >
                    কুইজ শুরু করুন
                </button>
                <button
                    onClick={onBackToDetails}
                    className="w-full sm:w-auto bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold py-3 px-8 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 dark:focus:ring-offset-gray-800"
                    aria-label="ধারার বিবরণে ফিরে যান"
                >
                    ফিরে যান
                </button>
            </div>
        </div>
    );
};

const QuizResult: React.FC<{
    section: LawSectionData;
    userAnswers: { [key: number]: string | boolean };
    score: number;
    onRetry: () => void;
    onBack: () => void;
    addRating: (id: number, rating: number) => void;
}> = ({ section, userAnswers, score, onRetry, onBack, addRating }) => {
    const totalPoints = useMemo(() => section.quiz.reduce((sum, q) => sum + q.points, 0), [section.quiz]);
    const correctAnswersCount = useMemo(() => section.quiz.filter(q => userAnswers[q.id] === q.correctAnswer).length, [section.quiz, userAnswers]);
    const [justRated, setJustRated] = useState(false);

    const handleRating = (rating: number) => {
        addRating(section.id, rating);
        setJustRated(true);
    };

    return (
        <div className="p-4 md:p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg animate-fade-in">
            <h2 className="text-2xl font-bold text-center text-emerald-700 dark:text-emerald-300 mb-4">কুইজের ফলাফল</h2>
            <div className="bg-emerald-50 dark:bg-emerald-900/50 text-center p-6 rounded-lg mb-6">
                <p className="text-lg text-gray-700 dark:text-gray-200">আপনি অর্জন করেছেন</p>
                <p className="text-5xl font-bold text-emerald-600 dark:text-emerald-400 my-2">{score} / {totalPoints}</p>
                <p className="text-lg text-gray-700 dark:text-gray-200">পয়েন্ট</p>
            </div>

            <div className="space-y-4">
                {section.quiz.map((q, index) => {
                    const userAnswer = userAnswers[q.id];
                    const isCorrect = userAnswer === q.correctAnswer;
                    return (
                        <div key={q.id} className={`p-4 rounded-lg ${isCorrect ? 'bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500' : 'bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500'}`}>
                            <p className="font-semibold mb-2">{index + 1}. {q.questionText}</p>
                            <div className="text-sm space-y-2">
                                <p className="flex items-start gap-2">
                                    <span className="font-medium w-28">আপনার উত্তর:</span>
                                    <span className={`flex items-center gap-1 ${isCorrect ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                                        {isCorrect ? <CheckIcon className="h-4 w-4" title="সঠিক"/> : <XIcon className="h-4 w-4" title="ভুল"/>}
                                        {String(userAnswer)}
                                    </span>
                                </p>
                                {!isCorrect && (
                                    <p className="flex items-start gap-2">
                                        <span className="font-medium w-28">সঠিক উত্তর:</span>
                                        <span className="flex items-center gap-1 text-gray-800 dark:text-gray-200">
                                            <CheckIcon className="h-4 w-4 text-green-600" title="সঠিক"/>
                                            {String(q.correctAnswer)}
                                        </span>
                                    </p>
                                )}
                                <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-600">
                                    <details open={!isCorrect} className="group">
                                        <summary className="cursor-pointer select-none list-none flex justify-between items-center font-semibold text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors py-1">
                                            <span>ব্যাখ্যা দেখুন</span>
                                            <ChevronDownIcon className="h-5 w-5 transition-transform duration-300 group-open:rotate-180" />
                                        </summary>
                                        <p className="mt-2 text-gray-700 dark:text-gray-300">
                                            {q.explanation}
                                        </p>
                                    </details>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="text-center text-gray-600 dark:text-gray-400 mt-6">
                <p>আপনি মোট {section.quiz.length}টি প্রশ্নের মধ্যে {correctAnswersCount}টির সঠিক উত্তর দিয়েছেন।</p>
            </div>
            
            <div className="mt-8 border-t dark:border-gray-700 pt-6 text-center">
                {justRated ? (
                    <p className="text-green-600 dark:text-green-400 font-semibold animate-pop-in">আপনার রেটিং দেওয়ার জন্য ধন্যবাদ!</p>
                ) : (
                    <>
                        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">এই কুইজটি আপনার জন্য কতটা সহায়ক ছিল?</h3>
                        <StarRating rating={0} onRatingChange={handleRating} />
                    </>
                )}
            </div>

            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-8">
                <button onClick={onRetry} className="w-full sm:w-auto bg-emerald-700 text-white font-bold py-3 px-8 rounded-lg hover:bg-emerald-800 transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 dark:focus:ring-offset-gray-800">
                    পুনরায় চেষ্টা করুন
                </button>
                <button onClick={onBack} className="w-full sm:w-auto bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold py-3 px-8 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 dark:focus:ring-offset-gray-800">
                    ধারার বিবরণে ফিরে যান
                </button>
            </div>
        </div>
    );
};

const QuizMode: React.FC<{ section: LawSectionData; onBackToIntro: () => void; addRating: (id: number, rating: number) => void; addUserScore: (points: number) => void; }> = ({ section, onBackToIntro, addRating, addUserScore }) => {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState<string | boolean | null>(null);
    const [userAnswers, setUserAnswers] = useState<{ [key: number]: string | boolean }>({});
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [score, setScore] = useState(0);
    const [quizFinished, setQuizFinished] = useState(false);
    const [showExplanation, setShowExplanation] = useState(false);

    const quiz = section.quiz;
    const currentQuestion = quiz[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / quiz.length) * 100;

    const handleOptionSelect = (option: string | boolean) => {
        if (!isSubmitted) {
            setSelectedOption(option);
        }
    };
    
    const handleSubmit = () => {
        if (selectedOption === null) return;

        const isCorrect = selectedOption === currentQuestion.correctAnswer;
        if (isCorrect) {
            setScore(prev => prev + currentQuestion.points);
        } else {
            // Automatically show explanation for incorrect answers
            setShowExplanation(true);
        }
        setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: selectedOption }));
        setIsSubmitted(true);
    };

    const handleNext = () => {
        if (currentQuestionIndex < quiz.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setSelectedOption(null);
            setIsSubmitted(false);
            setShowExplanation(false);
        } else {
            setQuizFinished(true);
        }
    };

    useEffect(() => {
        if (quizFinished) {
            addUserScore(score);
        }
    }, [quizFinished, score, addUserScore]);
    
    const resetQuiz = () => {
        setCurrentQuestionIndex(0);
        setSelectedOption(null);
        setUserAnswers({});
        setIsSubmitted(false);
        setShowExplanation(false);
        setScore(0);
        setQuizFinished(false);
    };

    if (quizFinished) {
        return <QuizResult section={section} userAnswers={userAnswers} score={score} onRetry={resetQuiz} onBack={onBackToIntro} addRating={addRating} />;
    }

    return (
        <div className="p-4 md:p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg animate-fade-in">
            {/* Progress Bar and Header */}
            <div className="mb-6">
                <div className="flex justify-between items-center mb-2 text-sm text-gray-600 dark:text-gray-400">
                    <span>প্রশ্ন {currentQuestionIndex + 1} / {quiz.length}</span>
                    <span>পয়েন্ট: {currentQuestion.points}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: `${progress}%`, transition: 'width 0.5s' }}></div>
                </div>
            </div>

            {/* Question */}
            <h3 className="text-xl font-semibold mb-6 text-center">{currentQuestion.questionText}</h3>

            {/* Options */}
            <div className="space-y-3">
                {currentQuestion.type === QuizType.MCQ && currentQuestion.options?.map((option, index) => {
                    const isSelected = selectedOption === option;
                    const isCorrect = currentQuestion.correctAnswer === option;
                    let buttonClass = "w-full text-left p-4 border-2 rounded-lg transition-all transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800";

                    if (isSubmitted) {
                        if (isCorrect) {
                            buttonClass += " bg-green-100 dark:bg-green-900/50 border-green-500";
                        } else if (isSelected && !isCorrect) {
                            buttonClass += " bg-red-100 dark:bg-red-900/50 border-red-500";
                        } else {
                            buttonClass += " border-gray-300 dark:border-gray-600 opacity-70";
                        }
                    } else {
                        buttonClass += isSelected 
                            ? " border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 ring-2 ring-emerald-400" 
                            : " border-gray-300 dark:border-gray-600 hover:border-emerald-400 focus:ring-emerald-400";
                    }

                    return (
                        <button key={index} onClick={() => handleOptionSelect(option)} disabled={isSubmitted} className={buttonClass}>
                            {option}
                        </button>
                    );
                })}
                 {currentQuestion.type === QuizType.TRUE_FALSE && [true, false].map((option, index) => {
                    const optionText = option ? 'সত্য' : 'মিথ্যা';
                    const isSelected = selectedOption === option;
                    const isCorrect = currentQuestion.correctAnswer === option;
                    let buttonClass = "w-full text-center p-4 border-2 rounded-lg transition-all transform hover:scale-[1.02] font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800";

                     if (isSubmitted) {
                        if (isCorrect) {
                            buttonClass += " bg-green-100 dark:bg-green-900/50 border-green-500";
                        } else if (isSelected && !isCorrect) {
                            buttonClass += " bg-red-100 dark:bg-red-900/50 border-red-500";
                        } else {
                            buttonClass += " border-gray-300 dark:border-gray-600 opacity-70";
                        }
                    } else {
                         buttonClass += isSelected 
                            ? " border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 ring-2 ring-emerald-400" 
                            : " border-gray-300 dark:border-gray-600 hover:border-emerald-400 focus:ring-emerald-400";
                    }
                    
                    return (
                        <button key={index} onClick={() => handleOptionSelect(option)} disabled={isSubmitted} className={buttonClass}>
                           {optionText}
                        </button>
                    );
                })}
            </div>

            {/* Feedback and Actions */}
            <div className="mt-8 text-center min-h-[90px]">
                 {isSubmitted && (
                    <div className="animate-fade-in mb-4">
                        <button onClick={() => setShowExplanation(prev => !prev)} className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded p-1 mb-2">
                           {showExplanation ? 'ব্যাখ্যা লুকান' : 'ব্যাখ্যা দেখুন'}
                        </button>
                        {showExplanation && (
                            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                                <p className="font-semibold">ব্যাখ্যা:</p>
                                <p>{currentQuestion.explanation}</p>
                            </div>
                        )}
                    </div>
                )}
                {!isSubmitted ? (
                    <button onClick={handleSubmit} disabled={selectedOption === null} className="w-full sm:w-auto bg-emerald-700 text-white font-bold py-3 px-8 rounded-lg hover:bg-emerald-800 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 dark:focus:ring-offset-gray-800">
                        উত্তর জমা দিন
                    </button>
                ) : (
                    <button onClick={handleNext} className="w-full sm:w-auto bg-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 shadow-lg transition-all animate-pop-in focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800">
                        {currentQuestionIndex < quiz.length - 1 ? 'পরবর্তী প্রশ্ন' : 'ফলাফল দেখুন'}
                    </button>
                )}
            </div>
        </div>
    );
};

const FlashcardMode: React.FC<{ section: LawSectionData; onBackToDetails: () => void; addRating: (id: number, rating: number) => void; }> = ({ section, onBackToDetails, addRating }) => {
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const flashcards = section.flashcards || [];
    const currentCard = flashcards[currentCardIndex];
    const [justRated, setJustRated] = useState(false);

    const handleFlip = () => setIsFlipped(prev => !prev);
    
    const handleNext = () => {
        if (currentCardIndex < flashcards.length - 1) {
            setIsFlipped(false);
            setCurrentCardIndex(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (currentCardIndex > 0) {
            setIsFlipped(false);
            setCurrentCardIndex(prev => prev - 1); // Corrected this line
        }
    };

    const handleRating = (rating: number) => {
        addRating(section.id, rating);
        setJustRated(true);
    };

    if (flashcards.length === 0) {
        return (
             <div className="p-4 md:p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg text-center">
                <p>এই ধারার জন্য কোনো ফ্ল্যাশকার্ড পাওয়া যায়নি।</p>
                <button onClick={onBackToDetails} className="mt-4 bg-emerald-700 text-white font-bold py-2 px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 dark:focus:ring-offset-gray-800">ফিরে যান</button>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg animate-fade-in">
            <h2 className="text-2xl font-bold text-center text-emerald-700 dark:text-emerald-300 mb-4">ফ্ল্যাশকার্ড: {section.title}</h2>
            <div className="text-center mb-4 text-gray-600 dark:text-gray-400">কার্ড {currentCardIndex + 1} / {flashcards.length}</div>
            
            {/* Flashcard */}
            <div className="[perspective:1000px] h-64 w-full max-w-lg mx-auto mb-6">
                <div
                    className={`relative w-full h-full text-center transition-transform duration-700 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
                    onClick={handleFlip}
                    role="button"
                    tabIndex={0}
                    aria-label="ফ্ল্যাশকার্ড উল্টান"
                    onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') handleFlip(); }}
                >
                    {/* Front */}
                    <div className="absolute w-full h-full [backface-visibility:hidden] bg-emerald-100 dark:bg-emerald-900 rounded-lg shadow-md flex items-center justify-center p-4">
                        <p className="text-xl font-semibold">{currentCard.question}</p>
                    </div>
                    {/* Back */}
                    <div className="absolute w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] bg-blue-100 dark:bg-blue-900 rounded-lg shadow-md flex items-center justify-center p-4">
                        <p className="text-lg">{currentCard.answer}</p>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex justify-center items-center gap-4">
                <button onClick={handlePrev} disabled={currentCardIndex === 0} className="p-3 rounded-full bg-gray-200 dark:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 dark:focus:ring-offset-gray-800">
                    <ArrowLeftIcon className="h-6 w-6" title="পূর্ববর্তী কার্ড"/>
                </button>
                <button onClick={handleFlip} className="flex items-center gap-2 bg-emerald-700 text-white font-bold py-2 px-6 rounded-lg hover:bg-emerald-800 transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 dark:focus:ring-offset-gray-800">
                    <FlipHorizontalIcon className="h-5 w-5" title="কার্ড উল্টান আইকন"/>
                    <span>কার্ড উল্টান</span>
                </button>
                <button onClick={handleNext} disabled={currentCardIndex === flashcards.length - 1} className="p-3 rounded-full bg-gray-200 dark:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 dark:focus:ring-offset-gray-800">
                    <ArrowRightIcon className="h-6 w-6" title="পরবর্তী কার্ড"/>
                </button>
            </div>
            
            <div className="mt-8 border-t dark:border-gray-700 pt-6 text-center">
                {justRated ? (
                    <p className="text-green-600 dark:text-green-400 font-semibold animate-pop-in">আপনার রেটিং দেওয়ার জন্য ধন্যবাদ!</p>
                ) : (
                    <>
                        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">এই ফ্ল্যাশকার্ডগুলো কতটা সহায়ক ছিল?</h3>
                        <StarRating rating={0} onRatingChange={handleRating} />
                    </>
                )}
            </div>

             <div className="text-center mt-8">
                <button onClick={onBackToDetails} className="text-emerald-600 dark:text-emerald-400 hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded">ধারার বিবরণে ফিরে যান</button>
            </div>
        </div>
    );
};


interface LawSectionDetailProps {
    section: LawSectionData;
    onBack: () => void;
    isBookmarked: boolean;
    onToggleBookmark: () => void;
    chapters: Chapter[];
    onNavigate: (section: LawSectionData) => void;
    ratings: Ratings;
    addRating: (id: number, rating: number) => void;
    addUserScore: (points: number) => void;
    onShare: (section: LawSectionData) => void;
    ratedSections: number[];
    markSectionAsRated: (id: number) => void;
}

const LawSectionDetail: React.FC<LawSectionDetailProps> = ({ section, onBack, isBookmarked, onToggleBookmark, chapters, onNavigate, ratings, addRating, addUserScore, onShare, ratedSections, markSectionAsRated }) => {
    const [view, setView] = useState<'details' | 'quizIntro' | 'quiz' | 'flashcards'>('details');
    const [justRated, setJustRated] = useState(false);
    const hasAlreadyRated = useMemo(() => ratedSections.includes(section.id), [ratedSections, section.id]);

    const handleRating = (rating: number) => {
        addRating(section.id, rating);
        markSectionAsRated(section.id);
        setJustRated(true);
    };

    const nextChapterSection = useMemo(() => {
        let currentChapterIndex = -1;
        let currentSectionIndex = -1;

        for (let i = 0; i < chapters.length; i++) {
            const sectionIndex = chapters[i].sections.findIndex(s => s.id === section.id);
            if (sectionIndex !== -1) {
                currentChapterIndex = i;
                currentSectionIndex = sectionIndex;
                break;
            }
        }

        if (currentChapterIndex === -1 || currentSectionIndex < chapters[currentChapterIndex].sections.length - 1) {
            return null;
        }

        for (let i = currentChapterIndex + 1; i < chapters.length; i++) {
            if (chapters[i].sections.length > 0) {
                return chapters[i].sections[0];
            }
        }
        
        return null;
    }, [section, chapters]);
    
    useEffect(() => {
      // Reset view to details when section changes
      setView('details');
      setJustRated(false);
    }, [section]);

    if (view === 'quiz') {
        return <QuizMode section={section} onBackToIntro={() => setView('quizIntro')} addRating={addRating} addUserScore={addUserScore} />;
    }
    
    if (view === 'quizIntro') {
        return <QuizIntro section={section} onStartQuiz={() => setView('quiz')} onBackToDetails={() => setView('details')} />;
    }
    
    if (view === 'flashcards') {
        return <FlashcardMode section={section} onBackToDetails={() => setView('details')} addRating={addRating} />;
    }


    return (
        <div className="p-4 md:p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg animate-fade-in">
             <button
                onClick={onBack}
                className="flex items-center gap-2 mb-4 text-emerald-600 dark:text-emerald-400 hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded"
                aria-label="ফিরে যান"
            >
                <ArrowLeftIcon className="h-5 w-5" title="ফিরে যান"/>
                <span>সকল অধ্যায়ে ফিরে যান</span>
            </button>
            <div className="flex justify-between items-start gap-4">
                <h2 className="flex-grow text-2xl md:text-3xl font-bold text-emerald-700 dark:text-emerald-300">{section.sectionNumber}: {section.title}</h2>
                <div className="flex items-center flex-shrink-0">
                    <button
                        onClick={() => onShare(section)}
                        className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 dark:focus:ring-offset-gray-800"
                        aria-label={`'${section.title}' শেয়ার করুন`}
                    >
                        <ShareIcon className="h-6 w-6 text-emerald-500" title={`'${section.title}' শেয়ার করুন`} />
                    </button>
                    <button
                        onClick={onToggleBookmark}
                        className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 dark:focus:ring-offset-gray-800"
                        aria-label={isBookmarked ? `'${section.title}' থেকে বুকমার্ক সরান` : `'${section.title}' বুকমার্ক করুন`}
                    >
                        <BookmarkIcon filled={isBookmarked} className="h-6 w-6 text-emerald-500" title={isBookmarked ? `'${section.title}' থেকে বুকমার্ক সরান` : `'${section.title}' বুকমার্ক করুন`} />
                    </button>
                </div>
            </div>
             <div className="mt-2 mb-4" title={`মোট ${ratings[section.id]?.length || 0}টি রেটিং`}>
                <AverageRating ratings={ratings[section.id]} showText={true} />
            </div>
            <p className="text-base text-gray-700 dark:text-gray-300 italic mb-4">{section.summary}</p>
            <div className="prose prose-lg dark:prose-invert max-w-none bg-gray-100 dark:bg-gray-900 p-4 rounded-md">
                 <h3 className="text-lg font-semibold mb-2">{section.scenario.title}</h3>
                 <p>{section.scenario.text}</p>
            </div>
            {section.fullText && (
                 <details className="mt-4">
                    <summary className="cursor-pointer font-semibold text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded">সম্পূর্ণ আইন দেখুন</summary>
                    <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-700 rounded-md whitespace-pre-wrap text-sm">
                        {section.fullText}
                    </div>
                </details>
            )}
            
            <div className="mt-8 border-t dark:border-gray-700 pt-6 space-y-8">
                <div className="text-center">
                    {(hasAlreadyRated || justRated) ? (
                        <div className="inline-block p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                            <p className="text-green-700 dark:text-green-300 font-semibold animate-pop-in flex items-center gap-2">
                                <CheckIcon className="h-5 w-5"/>
                                আপনার রেটিং দেওয়ার জন্য ধন্যবাদ!
                            </p>
                        </div>
                    ) : (
                        <div>
                            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">এই ধারাটি কতটা সহায়ক ছিল? রেটিং দিন।</h3>
                            <StarRating rating={0} onRatingChange={handleRating} />
                        </div>
                    )}
                </div>
                <div>
                    <h3 className="text-xl text-center font-semibold mb-4">অনুশীলন করুন</h3>
                     <div className="flex flex-col md:flex-row gap-4 justify-center">
                        {section.quiz && section.quiz.length > 0 && (
                             <button
                                onClick={() => setView('quizIntro')}
                                className="flex-1 bg-emerald-700 text-white font-bold py-3 px-6 rounded-lg hover:bg-emerald-800 transition-transform transform hover:scale-105 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 dark:focus:ring-offset-gray-800"
                                aria-label={`'${section.title}' এর জন্য কুইজ দিন`}
                            >
                                কুইজ দিন
                            </button>
                        )}
                        {section.flashcards && section.flashcards.length > 0 && (
                             <button
                                onClick={() => setView('flashcards')}
                                className="flex-1 bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-transform transform hover:scale-105 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
                                aria-label={`'${section.title}' এর জন্য ফ্ল্যাশকার্ড দেখুন`}
                            >
                                ফ্ল্যাশকার্ড অনুশীলন
                            </button>
                        )}
                     </div>
                 </div>
                 {nextChapterSection && (
                    <div className="text-center">
                        <button
                            onClick={() => onNavigate(nextChapterSection)}
                            className="inline-flex items-center gap-2 bg-gray-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-transform transform hover:scale-105 shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:focus:ring-offset-gray-800"
                            aria-label={`পরবর্তী অধ্যায়ে যান: ${chapters.find(c => c.sections.some(s => s.id === nextChapterSection.id))?.title}`}
                        >
                            <span>পরবর্তী অধ্যায়</span>
                            <ArrowRightIcon className="h-5 w-5" title="পরবর্তী অধ্যায়"/>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

interface ChapterAccordionProps {
    chapter: Chapter;
    onSelectSection: (section: LawSectionData) => void;
    bookmarkedSections: number[];
    onToggleBookmark: (id: number) => void;
    ratings: Ratings;
}

const ChapterAccordion: React.FC<ChapterAccordionProps> = ({ chapter, onSelectSection, bookmarkedSections, onToggleBookmark, ratings }) => {
    const [isOpen, setIsOpen] = useState(false);

    if (chapter.sections.length === 0) return null;

    return (
        <div className="border-b dark:border-gray-700">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center p-4 text-left font-semibold text-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500"
                aria-expanded={isOpen}
            >
                <span>{chapter.title}</span>
                <ChevronDownIcon className={`h-6 w-6 transition-transform ${isOpen ? 'rotate-180' : ''}`} title={isOpen ? 'অধ্যায় লুকান' : 'অধ্যায় দেখান'} />
            </button>
            {isOpen && (
                <ul className="bg-gray-50 dark:bg-gray-800/50 p-2 overflow-hidden">
                    {chapter.sections.map((section, index) => (
                        <li 
                            key={section.id} 
                            className="flex items-center justify-between gap-2 animate-slide-down-fade"
                            style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
                        >
                            <button
                                onClick={() => onSelectSection(section)}
                                className="flex-grow text-left p-3 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500"
                            >
                                <div>
                                    <span className="font-medium text-emerald-700 dark:text-emerald-400">{section.sectionNumber}:</span> {section.title}
                                </div>
                                <div className="mt-1">
                                    <AverageRating ratings={ratings[section.id]} />
                                </div>
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleBookmark(section.id);
                                }}
                                className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 dark:focus:ring-offset-gray-800"
                                aria-label={bookmarkedSections.includes(section.id) ? `'${section.title}' থেকে বুকমার্ক সরান` : `'${section.title}' বুকমার্ক করুন`}
                            >
                                <BookmarkIcon filled={bookmarkedSections.includes(section.id)} className="h-5 w-5 text-emerald-500" title={bookmarkedSections.includes(section.id) ? `'${section.title}' থেকে বুকমার্ক সরান` : `'${section.title}' বুকমার্ক করুন`} />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const PracticeZone: React.FC<{ onStart: () => void }> = ({ onStart }) => (
    <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
        <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mb-2">অনুশীলন এলাকা</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">সকল অধ্যায় থেকে এলোমেলো প্রশ্ন দিয়ে আপনার জ্ঞান পরীক্ষা করুন।</p>
        <button
            onClick={onStart}
            className="bg-emerald-700 text-white font-bold py-3 px-8 rounded-lg hover:bg-emerald-800 transition-transform transform hover:scale-105 shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 dark:focus:ring-offset-gray-800"
        >
            অনুশীলন শুরু করুন
        </button>
    </div>
);

// A new type for questions that includes the section title
type PracticeQuestion = Question & { sectionTitle: string };

const PracticeResult: React.FC<{
    score: number;
    totalQuestions: number;
    userAnswers: { [key: number]: string | boolean };
    questions: PracticeQuestion[];
    onRetry: () => void;
    onBackToHome: () => void;
}> = ({ score, totalQuestions, userAnswers, questions, onRetry, onBackToHome }) => {
    return (
        <div className="p-4 md:p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg animate-fade-in">
            <h2 className="text-2xl font-bold text-center text-emerald-700 dark:text-emerald-300 mb-4">অনুশীলনের ফলাফল</h2>
            <div className="bg-emerald-50 dark:bg-emerald-900/50 text-center p-6 rounded-lg mb-6">
                <p className="text-lg text-gray-700 dark:text-gray-200">আপনার স্কোর</p>
                <p className="text-5xl font-bold text-emerald-600 dark:text-emerald-400 my-2">{score} / {totalQuestions * 10}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">({totalQuestions}টি প্রশ্নের মধ্যে {score/10}টি সঠিক)</p>
            </div>

            <div className="space-y-4">
                {questions.map((q, index) => {
                    const userAnswer = userAnswers[q.id];
                    const isCorrect = userAnswer === q.correctAnswer;
                    return (
                        <div key={q.id} className={`p-4 rounded-lg ${isCorrect ? 'bg-green-50 dark:bg-green-900/30' : 'bg-red-50 dark:bg-red-900/30'}`}>
                           <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">{q.sectionTitle}</p>
                           <p className="font-semibold mb-2">{index + 1}. {q.questionText}</p>
                           <div className="text-sm space-y-2">
                               <p className={`flex items-center gap-1 ${isCorrect ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                                   {isCorrect ? <CheckIcon className="h-4 w-4" title="সঠিক"/> : <XIcon className="h-4 w-4" title="ভুল"/>}
                                   আপনার উত্তর: {String(userAnswer)}
                               </p>
                               {!isCorrect && (
                                   <p className="text-gray-800 dark:text-gray-200">
                                       সঠিক উত্তর: {String(q.correctAnswer)}
                                   </p>
                               )}
                           </div>
                        </div>
                    );
                })}
            </div>
            
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-8">
                <button onClick={onRetry} className="w-full sm:w-auto bg-emerald-700 text-white font-bold py-3 px-8 rounded-lg hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 dark:focus:ring-offset-gray-800">পুনরায় চেষ্টা করুন</button>
                <button onClick={onBackToHome} className="w-full sm:w-auto bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold py-3 px-8 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 dark:focus:ring-offset-gray-800">হোমে ফিরে যান</button>
            </div>
        </div>
    );
};

const PracticeMode: React.FC<{ onBackToHome: () => void; addUserScore: (points: number) => void; }> = ({ onBackToHome, addUserScore }) => {
    const practiceQuestions = useMemo(() => {
        const allQuestions: PracticeQuestion[] = lawSections.flatMap(section => 
            section.quiz.map(q => ({
                ...q,
                sectionTitle: `${section.sectionNumber}: ${section.title}`
            }))
        );
        // Shuffle and pick 10 questions
        return allQuestions.sort(() => 0.5 - Math.random()).slice(0, 10);
    }, []);

    const [questions, setQuestions] = useState<PracticeQuestion[]>(practiceQuestions);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState<string | boolean | null>(null);
    const [userAnswers, setUserAnswers] = useState<{ [key: number]: string | boolean }>({});
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [score, setScore] = useState(0);
    const [practiceFinished, setPracticeFinished] = useState(false);

    const currentQuestion = questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

    const handleSubmit = () => {
        if (selectedOption === null) return;
        const isCorrect = selectedOption === currentQuestion.correctAnswer;
        if (isCorrect) {
            setScore(prev => prev + currentQuestion.points);
        }
        setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: selectedOption }));
        setIsSubmitted(true);
    };

    const handleNext = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setSelectedOption(null);
            setIsSubmitted(false);
        } else {
            setPracticeFinished(true);
        }
    };
    
    useEffect(() => {
        if (practiceFinished) {
            addUserScore(score);
        }
    }, [practiceFinished, score, addUserScore]);

    const resetPractice = () => {
        const newQuestions = [...practiceQuestions].sort(() => 0.5 - Math.random());
        setQuestions(newQuestions);
        setCurrentQuestionIndex(0);
        setSelectedOption(null);
        setUserAnswers({});
        setIsSubmitted(false);
        setScore(0);
        setPracticeFinished(false);
    };

    if (practiceFinished) {
        return <PracticeResult 
            score={score} 
            totalQuestions={questions.length}
            userAnswers={userAnswers}
            questions={questions}
            onRetry={resetPractice} 
            onBackToHome={onBackToHome} />;
    }
    
    if (!currentQuestion) return <div>Loading...</div>

    return (
        <div className="p-4 md:p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg animate-fade-in">
            <div className="flex justify-between items-center mb-1">
                 <h2 className="text-xl font-bold text-emerald-700 dark:text-emerald-300">অনুশীলন মোড</h2>
                 <button onClick={onBackToHome} className="text-sm text-gray-500 hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded">ত্যাগ করুন</button>
            </div>
            {/* Progress Bar and Header */}
            <div className="mb-6">
                 <div className="flex justify-between items-center mb-2 text-sm text-gray-600 dark:text-gray-400">
                    <span>প্রশ্ন {currentQuestionIndex + 1} / {questions.length}</span>
                    <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{currentQuestion.sectionTitle}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: `${progress}%`, transition: 'width 0.5s' }}></div>
                </div>
            </div>

            {/* Question */}
            <h3 className="text-xl font-semibold mb-6 text-center">{currentQuestion.questionText}</h3>

            {/* Options (Copied from QuizMode) */}
             <div className="space-y-3">
                {currentQuestion.type === QuizType.MCQ && currentQuestion.options?.map((option, index) => {
                    const isSelected = selectedOption === option;
                    let buttonClass = "w-full text-left p-4 border-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800";
                    buttonClass += isSelected 
                        ? " border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 ring-2 ring-emerald-400" 
                        : " border-gray-300 dark:border-gray-600 hover:border-emerald-400 focus:ring-emerald-400";
                    return (
                        <button key={index} onClick={() => setSelectedOption(option)} disabled={isSubmitted} className={buttonClass}>
                            {option}
                        </button>
                    );
                })}
                 {currentQuestion.type === QuizType.TRUE_FALSE && [true, false].map((option, index) => {
                    const optionText = option ? 'সত্য' : 'মিথ্যা';
                    const isSelected = selectedOption === option;
                    let buttonClass = "w-full text-center p-4 border-2 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800";
                     buttonClass += isSelected 
                        ? " border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 ring-2 ring-emerald-400" 
                        : " border-gray-300 dark:border-gray-600 hover:border-emerald-400 focus:ring-emerald-400";
                    return (
                        <button key={index} onClick={() => setSelectedOption(option)} disabled={isSubmitted} className={buttonClass}>
                           {optionText}
                        </button>
                    );
                })}
            </div>

             {/* Feedback and Actions */}
            <div className="mt-8 text-center">
                 {isSubmitted && (
                    <div className={`p-3 mb-4 rounded-lg animate-fade-in ${selectedOption === currentQuestion.correctAnswer ? 'bg-green-100 dark:bg-green-900/50' : 'bg-red-100 dark:bg-red-900/50'}`}>
                        <p className="font-semibold">ব্যাখ্যা:</p>
                        <p>{currentQuestion.explanation}</p>
                    </div>
                )}
                {!isSubmitted ? (
                    <button onClick={handleSubmit} disabled={selectedOption === null} className="w-full sm:w-auto bg-emerald-700 text-white font-bold py-3 px-8 rounded-lg hover:bg-emerald-800 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 dark:focus:ring-offset-gray-800">
                        উত্তর জমা দিন
                    </button>
                ) : (
                    <button onClick={handleNext} className="w-full sm:w-auto bg-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 shadow-lg animate-pop-in focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800">
                        {currentQuestionIndex < questions.length - 1 ? 'পরবর্তী প্রশ্ন' : 'ফলাফল দেখুন'}
                    </button>
                )}
            </div>
        </div>
    );
};

const Leaderboard: React.FC<{ userScore: number; onBack: () => void }> = ({ userScore, onBack }) => {
    const leaderboard = useMemo(() => {
        const userEntry = { name: 'আপনি', score: userScore };
        const combined = [...leaderboardData.filter(p => p.name !== userEntry.name), userEntry];
        return combined.sort((a, b) => b.score - a.score);
    }, [userScore]);

    const getRankContent = (rank: number) => {
        if (rank === 0) return <span className="text-3xl" role="img" aria-label="First place">🥇</span>;
        if (rank === 1) return <span className="text-3xl" role="img" aria-label="Second place">🥈</span>;
        if (rank === 2) return <span className="text-3xl" role="img" aria-label="Third place">🥉</span>;
        return <span className="text-gray-500 dark:text-gray-400 font-bold">{rank + 1}</span>;
    };

    return (
        <div className="p-4 md:p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg animate-fade-in">
            <button
                onClick={onBack}
                className="flex items-center gap-2 mb-4 text-emerald-600 dark:text-emerald-400 hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded"
                aria-label="ফিরে যান"
            >
                <ArrowLeftIcon className="h-5 w-5" title="ফিরে যান"/>
                <span>হোমে ফিরে যান</span>
            </button>
            <h2 className="text-3xl font-bold text-center text-emerald-700 dark:text-emerald-300 my-4 flex items-center justify-center gap-2">
                <TrophyIcon className="h-8 w-8 text-amber-400" />
                লিডারবোর্ড
            </h2>
            <div className="max-w-2xl mx-auto">
                <ul className="space-y-3">
                    {leaderboard.map((player, index) => {
                        const isUser = player.name === 'আপনি';
                        return (
                            <li key={index} className={`flex items-center justify-between p-4 rounded-lg shadow transition-transform hover:scale-105 ${isUser ? 'bg-emerald-100 dark:bg-emerald-900 border-2 border-emerald-500' : 'bg-gray-50 dark:bg-gray-900/50'}`}>
                                <div className="flex items-center gap-4">
                                    <div className="w-8 text-center">{getRankContent(index)}</div>
                                    <span className={`font-bold ${isUser ? 'text-emerald-800 dark:text-emerald-200' : ''}`}>{player.name}</span>
                                </div>
                                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{player.score.toLocaleString('bn-BD')}</span>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
};


const Sidebar: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    chapters: Chapter[];
    onNavigateToHome: () => void;
    onNavigateToPractice: () => void;
    onNavigateToLeaderboard: () => void;
    onNavigateToBookmarks: () => void;
    onNavigateToSearch: () => void;
    onSelectSection: (section: LawSectionData) => void;
}> = ({ isOpen, onClose, chapters, onNavigateToHome, onNavigateToPractice, onNavigateToLeaderboard, onNavigateToBookmarks, onNavigateToSearch, onSelectSection }) => {
    const [openChapters, setOpenChapters] = useState<Set<string>>(new Set());

    const toggleChapter = (chapterId: string) => {
        setOpenChapters(prev => {
            const newSet = new Set(prev);
            if (newSet.has(chapterId)) {
                newSet.delete(chapterId);
            } else {
                newSet.add(chapterId);
            }
            return newSet;
        });
    };

    return (
        <>
            <div
                className={`fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
                aria-hidden={!isOpen}
            ></div>
            <aside
                className={`fixed top-0 left-0 w-72 h-full bg-white dark:bg-gray-800 shadow-lg z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="sidebar-title"
            >
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h2 id="sidebar-title" className="text-xl font-bold text-emerald-600 dark:text-emerald-400">মেনু</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="মেনু বন্ধ করুন">
                        <XIcon className="h-6 w-6" title="মেনু বন্ধ করুন" />
                    </button>
                </div>
                <nav className="p-4 h-[calc(100%-65px)] overflow-y-auto">
                    <ul className="space-y-2">
                        <li><button onClick={() => { onNavigateToHome(); onClose(); }} className="w-full text-left p-2 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900 flex items-center gap-2"><UserIcon className="h-5 w-5" /><span>হোম</span></button></li>
                        <li><button onClick={() => { onNavigateToPractice(); onClose(); }} className="w-full text-left p-2 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900 flex items-center gap-2"><PencilIcon className="h-5 w-5" /><span>অনুশীলন এলাকা</span></button></li>
                        <li><button onClick={() => { onNavigateToLeaderboard(); onClose(); }} className="w-full text-left p-2 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900 flex items-center gap-2"><TrophyIcon className="h-5 w-5" /><span>লিডারবোর্ড</span></button></li>
                        <li>
                            <div className="flex items-center gap-2">
                                <button onClick={onNavigateToSearch} className="flex flex-1 items-center justify-center gap-2 rounded p-2 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500">
                                    <SearchIcon className="h-5 w-5" />
                                    <span>অনুসন্ধান</span>
                                </button>
                                <button onClick={() => { onNavigateToBookmarks(); onClose(); }} className="flex flex-1 items-center justify-center gap-2 rounded p-2 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500">
                                    <BookmarkIcon className="h-5 w-5" />
                                    <span>বুকমার্ক</span>
                                </button>
                            </div>
                        </li>
                        <li className="pt-4 mt-2 border-t dark:border-gray-700"><span className="px-2 text-sm font-semibold text-gray-500">অধ্যায়সমূহ</span></li>
                        {chapters.filter(c => c.sections.length > 0).map(chapter => {
                             const isChapterOpen = openChapters.has(chapter.id);
                             return (
                                <li key={chapter.id}>
                                    <button
                                        onClick={() => toggleChapter(chapter.id)}
                                        className="w-full flex justify-between items-center text-left p-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 font-semibold"
                                        aria-expanded={isChapterOpen}
                                    >
                                        <span>{chapter.title}</span>
                                        <ChevronDownIcon className={`h-5 w-5 transition-transform ${isChapterOpen ? 'rotate-180' : ''}`} title={isChapterOpen ? 'অধ্যায় লুকান' : 'অধ্যায় দেখান'} />
                                    </button>
                                    {isChapterOpen && (
                                        <ul className="pl-4 mt-1 space-y-1 border-l-2 border-emerald-200 dark:border-emerald-800">
                                            {chapter.sections.map(section => (
                                                <li key={section.id}>
                                                     <button
                                                        onClick={() => {
                                                            onSelectSection(section);
                                                            onClose();
                                                        }}
                                                        className="w-full text-left p-2 text-xs rounded hover:bg-emerald-100 dark:hover:bg-emerald-900"
                                                    >
                                                        <span className="font-semibold">{section.sectionNumber}</span>: {section.title}
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </nav>
            </aside>
        </>
    );
};


const BookmarksModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    bookmarkedSectionsData: LawSectionData[];
    onSelectSection: (section: LawSectionData) => void;
}> = ({ isOpen, onClose, bookmarkedSectionsData, onSelectSection }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="bookmarks-modal-title">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h2 id="bookmarks-modal-title" className="text-xl font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                        <BookmarkIcon filled className="h-6 w-6" />
                        বুকমার্ক করা ধারা
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="বন্ধ করুন">
                        <XIcon className="h-6 w-6" />
                    </button>
                </div>
                <div className="overflow-y-auto p-4">
                    {bookmarkedSectionsData.length > 0 ? (
                        <ul className="space-y-2">
                            {bookmarkedSectionsData.map(section => (
                                <li key={`modal-bookmark-${section.id}`}>
                                    <button
                                        onClick={() => {
                                            onClose();
                                            onSelectSection(section);
                                        }}
                                        className="w-full text-left p-3 rounded-md bg-gray-50 dark:bg-gray-900/50 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500"
                                    >
                                        <span className="font-medium text-emerald-700 dark:text-emerald-400">{section.sectionNumber}:</span> {section.title}
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{section.summary}</p>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-gray-500 py-8">কোনো ধারা বুকমার্ক করা নেই।</p>
                    )}
                </div>
            </div>
        </div>
    );
};

const GlossaryModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    terms: GlossaryTerm[];
}> = ({ isOpen, onClose, terms }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTerm, setSelectedTerm] = useState<GlossaryTerm | null>(terms[0] || null);
    
    const filteredTerms = useMemo(() => {
        if (!searchTerm) return terms;
        return terms.filter(term => term.term.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [searchTerm, terms]);

    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setSelectedTerm(terms[0] || null);
        }
    }, [isOpen, terms]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="glossary-modal-title">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 flex-shrink-0">
                    <h2 id="glossary-modal-title" className="text-xl font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                        <BookOpenIcon className="h-6 w-6" />
                        আইনি শব্দকোষ
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="বন্ধ করুন">
                        <XIcon className="h-6 w-6" />
                    </button>
                </div>
                <div className="flex-grow flex flex-col md:flex-row min-h-0">
                    {/* Terms List */}
                    <div className="w-full md:w-1/3 border-r dark:border-gray-700 flex flex-col">
                        <div className="p-2 border-b dark:border-gray-700">
                            <input
                                type="text"
                                placeholder="শব্দ খুঁজুন..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md bg-gray-100 dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                        <ul className="overflow-y-auto flex-grow">
                            {filteredTerms.map(term => (
                                <li key={term.term}>
                                    <button
                                        onClick={() => setSelectedTerm(term)}
                                        className={`w-full text-left p-3 text-sm transition-colors ${selectedTerm?.term === term.term ? 'bg-emerald-100 dark:bg-emerald-900 font-semibold text-emerald-800 dark:text-emerald-200' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                    >
                                        {term.term}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                    {/* Definition View */}
                    <div className="w-full md:w-2/3 p-6 overflow-y-auto">
                        {selectedTerm ? (
                            <div className="animate-fade-in">
                                <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mb-3">{selectedTerm.term}</h3>
                                <p className="text-base leading-relaxed">{selectedTerm.definition}</p>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-500">
                                <p>একটি শব্দ নির্বাচন করুন।</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const HomePage: React.FC<{ onStart: () => void }> = ({ onStart }) => {
  return (
    <div className="flex flex-col items-center justify-center text-center min-h-[calc(100vh-200px)] animate-fade-in">
      <div className="p-4 bg-emerald-100 dark:bg-emerald-900 rounded-full mb-6 animate-float">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
      </div>
      <h1 className="text-4xl md:text-5xl font-bold text-emerald-700 dark:text-emerald-300 mb-4">
        স্বাগতম! শ্রম আইন শিখুন, সহজে ও মজায়।
      </h1>
      <p className="max-w-2xl text-lg text-gray-600 dark:text-gray-300 mb-8">
        বাংলাদেশ শ্রম আইন, ২০০৬ এর জটিল ধারাগুলো এখন আপনার হাতের মুঠোয়। ইন্টারেক্টিভ কুইজ, ফ্ল্যাশকার্ড এবং লিডারবোর্ডের মাধ্যমে আপনার জ্ঞানকে শাণিত করুন।
      </p>
      <button
        onClick={onStart}
        className="inline-flex items-center justify-center bg-emerald-700 text-white font-bold py-4 px-10 rounded-lg text-lg hover:bg-emerald-800 transition-transform transform hover:scale-105 shadow-xl focus:outline-none focus:ring-4 focus:ring-emerald-500/50"
      >
        <span>আইন পড়া শুরু করুন</span>
        <ArrowRightIcon className="h-6 w-6 ml-2" />
      </button>
    </div>
  );
};

// --- Chatbot Types ---
interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

const App: React.FC = () => {
    const [theme, toggleTheme] = useDarkMode();
    const [bookmarkedSections, toggleBookmark] = useBookmarks();
    const [ratings, addRating] = useRatings();
    const [ratedSections, markSectionAsRated] = useRatedSections();
    const [userScore, addUserScore] = useUserScore();
    const [activeView, setActiveView] = useState<'landing' | 'home' | 'section' | 'practice' | 'leaderboard'>('landing');
    const [selectedSection, setSelectedSection] = useState<LawSectionData | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<FuseResult<LawSectionData>[]>([]);
    const [filterChapterId, setFilterChapterId] = useState('all');
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isBookmarksModalOpen, setIsBookmarksModalOpen] = useState(false);
    const [isGlossaryModalOpen, setIsGlossaryModalOpen] = useState(false);
    const [showScrollToTop, setShowScrollToTop] = useState(false);
    
    // --- Chatbot State ---
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [chatError, setChatError] = useState<string | null>(null);
    const [chatInstance, setChatInstance] = useState<Chat | null>(null);
    const [chatInput, setChatInput] = useState('');
    const chatContainerRef = useRef<HTMLDivElement>(null);

    const searchContainerRef = useRef<HTMLDivElement>(null);
    const mainContentRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const fuse = useMemo(() => new Fuse(lawSections, {
        keys: ['title', 'summary', 'sectionNumber', 'fullText'],
        includeMatches: true,
        minMatchCharLength: 2,
        threshold: 0.4,
    }), []);
    
    const bookmarkedSectionData = useMemo(() =>
        lawSections.filter(s => bookmarkedSections.includes(s.id)),
        [bookmarkedSections]
    );

    useEffect(() => {
        if (searchQuery.trim().length > 1) {
            let results = fuse.search(searchQuery.trim());
            if (filterChapterId !== 'all') {
                const sectionsInChapter = chapters.find(c => c.id === filterChapterId)?.sections.map(s => s.id) || [];
                results = results.filter(r => sectionsInChapter.includes(r.item.id));
            }
            setSearchResults(results);
        } else {
            setSearchResults([]);
        }
        setHighlightedIndex(-1); // Reset highlight when query changes
    }, [searchQuery, fuse, filterChapterId, chapters]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setIsSearchFocused(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsSidebarOpen(false);
                setIsSearchFocused(false);
                setIsBookmarksModalOpen(false);
                setIsGlossaryModalOpen(false);
                setIsChatOpen(false);
            }
        };
        document.addEventListener('keydown', handleKeyDown);

        const checkScrollTop = () => {
            if (window.scrollY > 300) {
                setShowScrollToTop(true);
            } else {
                setShowScrollToTop(false);
            }
        };
        window.addEventListener('scroll', checkScrollTop);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('scroll', checkScrollTop);
        };
    }, []);
    
    // --- Chatbot Effects ---
    useEffect(() => {
        if (isChatOpen && !chatInstance) {
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
                const newChat = ai.chats.create({
                    model: 'gemini-2.5-flash',
                    config: {
                        systemInstruction: 'You are "শ্রম আইন সহায়ক", an expert AI assistant for the Bangladesh Labour Act, 2006. Your primary goal is to help users understand the law in-depth. Always respond in Bengali. Provide detailed and comprehensive explanations for all queries. When a topic is complex, break it down into smaller, easy-to-understand points. Your tone should be encouraging and patient, like a helpful tutor. Proactively offer to clarify specific legal terms or related sections to enhance the user\'s understanding. To maintain a natural and helpful conversation, always ask relevant follow-up questions after providing an answer to encourage the user to explore the topic further. Base your answers strictly on the provided legal text and context.',
                    },
                });
                setChatInstance(newChat);
            } catch (e: any) {
                console.error("Failed to initialize GenAI chat:", e);
                setChatError("চ্যাট শুরু করতে একটি সমস্যা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।");
            }
        }

        if (isChatOpen && chatMessages.length === 0) {
            const initialGreeting = selectedSection
                ? `আসসালামু আলাইকুম! আমি শ্রম আইন সহায়ক। আপনি বর্তমানে '${selectedSection.title}' দেখছেন। এই বিষয়ে বা শ্রম আইনের অন্য কোনো বিষয়ে আপনার প্রশ্ন করতে পারেন।`
                : 'আসসালামু আলাইকুম! আমি শ্রম আইন সহায়ক। বাংলাদেশ শ্রম আইন, ২০০৬ বিষয়ে আপনার যেকোনো প্রশ্ন করতে পারেন।';
            setChatMessages([{ role: 'model', text: initialGreeting }]);
        }
    }, [isChatOpen, chatInstance, selectedSection, chatMessages.length]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatMessages]);
    
    const handleShareSection = async (section: LawSectionData | null) => {
        if (!section) return;
        const shareData = {
            title: `${section.sectionNumber}: ${section.title}`,
            text: section.summary,
            url: window.location.href, // This will share the main app URL.
        };
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                 alert('আপনার ব্রাউজার এই ফিচারটি সমর্থন করে না।');
            }
        } catch (err) {
            console.error("Share failed:", err);
        }
    };

    // --- Chatbot Handler ---
    const handleSendChatMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() || isChatLoading || !chatInstance) return;

        const userMessage: ChatMessage = { role: 'user', text: chatInput };
        setChatMessages(prev => [...prev, userMessage]);
        setChatInput('');
        setIsChatLoading(true);
        setChatError(null);

        try {
            const result = await chatInstance.sendMessageStream({ message: userMessage.text });
            
            let currentModelMessage = '';
            setChatMessages(prev => [...prev, { role: 'model', text: '' }]);

            for await (const chunk of result) {
                currentModelMessage += chunk.text;
                setChatMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = { role: 'model', text: currentModelMessage };
                    return newMessages;
                });
            }
        } catch (e: any) {
            console.error("Error sending message:", e);
            const errorMessage = "দুঃখিত, একটি সমস্যা হয়েছে। আপনার বার্তা পাঠানো যায়নি।";
            setChatError(errorMessage);
            setChatMessages(prev => [...prev, { role: 'model', text: errorMessage }]);
        } finally {
            setIsChatLoading(false);
        }
    };

    const handleSelectSection = (section: LawSectionData, shouldScroll: boolean = false) => {
        setSelectedSection(section);
        setActiveView('section');
        setIsSearchFocused(false); // Hide dropdown but preserve query
        if (shouldScroll) {
            mainContentRef.current?.scrollIntoView({ behavior: 'smooth' });
        } else {
             window.scrollTo(0, 0);
        }
    };

    const handleBackToHome = () => {
        setActiveView('home');
        setSelectedSection(null);
        window.scrollTo(0, 0);
    };
    
    const handleStartPractice = () => {
        setActiveView('practice');
        window.scrollTo(0, 0);
    }
    
    const handleNavigateToLeaderboard = () => {
        setActiveView('leaderboard');
        window.scrollTo(0, 0);
    }

    const handleNavigateToBookmarks = () => {
        setIsBookmarksModalOpen(true);
    };

    const handleNavigateToSearch = () => {
        setIsSidebarOpen(false);
        // Delay focus to allow sidebar to animate out
        setTimeout(() => {
            searchInputRef.current?.focus();
        }, 300); // Corresponds to the transition duration
    };

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
        const hasResults = searchResults.length > 0;
        if (!hasResults) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev + 1) % searchResults.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev - 1 + searchResults.length) % searchResults.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && searchResults[highlightedIndex]) {
                handleSelectSection(searchResults[highlightedIndex].item, true);
            }
        }
    };

    const showSearchResults = isSearchFocused && searchQuery.length > 1;

    return (
        <div className={`bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen transition-colors`}>
            <Sidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                chapters={chapters}
                onNavigateToHome={handleBackToHome}
                onNavigateToPractice={handleStartPractice}
                onNavigateToLeaderboard={handleNavigateToLeaderboard}
                onNavigateToBookmarks={handleNavigateToBookmarks}
                onNavigateToSearch={handleNavigateToSearch}
                onSelectSection={handleSelectSection}
            />

            <BookmarksModal
                isOpen={isBookmarksModalOpen}
                onClose={() => setIsBookmarksModalOpen(false)}
                bookmarkedSectionsData={bookmarkedSectionData}
                onSelectSection={handleSelectSection}
            />
            
            <GlossaryModal
                isOpen={isGlossaryModalOpen}
                onClose={() => setIsGlossaryModalOpen(false)}
                terms={glossaryTerms}
            />


            <header className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-20 p-4 border-b dark:border-gray-700">
                <div className="container mx-auto flex justify-between items-center gap-4">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsSidebarOpen(true)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500" aria-label="মেনু খুলুন">
                            <MenuIcon className="h-6 w-6" title="মেনু খুলুন"/>
                        </button>
                        <h1 className="text-xl md:text-2xl font-bold text-emerald-600 dark:text-emerald-400 hidden sm:block">শ্রম আইন শিখি</h1>
                    </div>
                    
                    <div className="flex items-center gap-2 md:gap-4">
                        <div className="w-48 sm:w-64 md:w-96" ref={searchContainerRef}>
                             <div className="relative">
                                <form onSubmit={(e) => e.preventDefault()} role="search" aria-label="আইনের ধারা অনুসন্ধান করুন">
                                    <label htmlFor="search-input" className="sr-only">অনুসন্ধান করুন</label>
                                    <input
                                        ref={searchInputRef}
                                        id="search-input"
                                        type="search"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onFocus={() => setIsSearchFocused(true)}
                                        onKeyDown={handleSearchKeyDown}
                                        placeholder="অনুসন্ধান করুন..."
                                        className="w-full pl-10 pr-4 py-2 border rounded-full bg-gray-100 dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                                        role="combobox"
                                        aria-expanded={showSearchResults}
                                        aria-controls="search-results-listbox"
                                        aria-activedescendant={highlightedIndex >= 0 ? `search-result-${highlightedIndex}` : undefined}
                                    />
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <SearchIcon className="h-5 w-5 text-gray-400" title="অনুসন্ধান আইকন"/>
                                    </div>
                                </form>
                                {showSearchResults && <SearchResults 
                                    results={searchResults} 
                                    query={searchQuery} 
                                    onSelectSection={handleSelectSection}
                                    chapters={chapters}
                                    filterChapterId={filterChapterId}
                                    onFilterChange={setFilterChapterId}
                                    highlightedIndex={highlightedIndex}
                                    onHighlightIndex={setHighlightedIndex}
                                    ratings={ratings}
                                />}
                            </div>
                        </div>
                        
                        <button
                            onClick={() => setIsGlossaryModalOpen(true)}
                            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 dark:focus:ring-offset-gray-800"
                            aria-label="শব্দকোষ খুলুন"
                        >
                           <BookOpenIcon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" title="শব্দকোষ"/>
                        </button>

                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 dark:focus:ring-offset-gray-800"
                            aria-label={theme === 'dark' ? 'লাইট মোড' : 'ডার্ক মোড'}
                        >
                            {theme === 'dark' ? <SunIcon className="h-6 w-6 text-yellow-400" title="লাইট মোড"/> : <MoonIcon className="h-6 w-6 text-gray-700" title="ডার্ক মোড"/>}
                        </button>
                    </div>
                </div>
                 {/* Screen reader only live region for search results count */}
                <div className="sr-only" role="status" aria-live="polite">
                    {showSearchResults && (
                        searchResults.length > 0
                            ? `${searchResults.length} ফলাফল পাওয়া গেছে।`
                            : searchQuery.length > 1 ? `অনুসন্ধানের জন্য কোন ফলাফল পাওয়া যায়নি "${searchQuery}"।` : ''
                    )}
                </div>
            </header>
            
            <main ref={mainContentRef} className="container mx-auto p-4 md:p-6">
                {activeView === 'landing' && (
                    <HomePage onStart={() => setActiveView('home')} />
                )}
                {activeView === 'home' && (
                    <div className="animate-fade-in space-y-6">
                         <PracticeZone onStart={handleStartPractice} />
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                             <div className="p-4 bg-emerald-700 text-white">
                                <h2 className="text-xl font-bold">বাংলাদেশ শ্রম আইন, ২০০৬ এর অধ্যায়সমূহ</h2>
                             </div>
                            {chapters.map(chapter => (
                                <div id={chapter.id} key={chapter.id}>
                                    <ChapterAccordion 
                                        chapter={chapter} 
                                        onSelectSection={handleSelectSection} 
                                        bookmarkedSections={bookmarkedSections}
                                        onToggleBookmark={toggleBookmark}
                                        ratings={ratings}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {activeView === 'section' && selectedSection && (
                    <LawSectionDetail 
                        section={selectedSection} 
                        onBack={handleBackToHome}
                        isBookmarked={bookmarkedSections.includes(selectedSection.id)}
                        onToggleBookmark={() => toggleBookmark(selectedSection.id)}
                        chapters={chapters}
                        onNavigate={handleSelectSection}
                        ratings={ratings}
                        addRating={addRating}
                        addUserScore={addUserScore}
                        onShare={handleShareSection}
                        ratedSections={ratedSections}
                        markSectionAsRated={markSectionAsRated}
                    />
                )}
                {activeView === 'practice' && (
                    <PracticeMode onBackToHome={handleBackToHome} addUserScore={addUserScore} />
                )}
                {activeView === 'leaderboard' && (
                    <Leaderboard userScore={userScore} onBack={handleBackToHome} />
                )}
            </main>
            
            {showScrollToTop && !isChatOpen && (
                <button
                    onClick={scrollToTop}
                    className="fixed bottom-6 right-6 bg-emerald-700 text-white p-3 rounded-full shadow-lg hover:bg-emerald-800 transition-transform transform hover:scale-110 z-30 animate-pop-in focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 dark:focus:ring-offset-gray-800"
                    aria-label="উপরে যান"
                >
                    <ArrowUpIcon className="h-6 w-6" title="উপরে যান" />
                </button>
            )}

            {/* --- Chatbot UI --- */}
            <div className="fixed bottom-6 right-6 z-30">
                 {/* Chat Window */}
                <div
                    className={`absolute bottom-full right-0 mb-4 w-[calc(100vw-2rem)] max-w-sm h-[70vh] max-h-[600px] bg-white dark:bg-gray-800 rounded-lg shadow-2xl flex flex-col transition-all duration-300 ease-in-out origin-bottom-right ${
                        isChatOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                    }`}
                >
                    <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 flex-shrink-0">
                        <h3 className="text-lg font-bold text-emerald-600 dark:text-emerald-400">শ্রম আইন সহায়ক</h3>
                        <div className="flex items-center">
                            <button
                                onClick={() => handleShareSection(selectedSection)}
                                disabled={!selectedSection}
                                className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label="বর্তমান ধারা শেয়ার করুন"
                                title="বর্তমান ধারা শেয়ার করুন"
                            >
                                <ShareIcon className="h-5 w-5" />
                            </button>
                            <button onClick={() => setIsChatOpen(false)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="চ্যাট বন্ধ করুন">
                                <XIcon className="h-6 w-6" />
                            </button>
                        </div>
                    </div>
                    <div ref={chatContainerRef} className="flex-1 p-4 overflow-y-auto space-y-4">
                        {chatMessages.map((msg, index) => (
                            <div key={index} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">সহা</div>}
                                <div className={`max-w-[80%] p-3 rounded-lg prose dark:prose-invert ${msg.role === 'user' ? 'bg-emerald-600 text-white rounded-br-none' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-none'}`}>
                                    <p className="mb-0" style={{whiteSpace: 'pre-wrap'}}>{msg.text}</p>
                                </div>
                            </div>
                        ))}
                        {isChatLoading && (
                            <div className="flex items-end gap-2 justify-start">
                                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">সহা</div>
                                <div className="max-w-[80%] p-3 rounded-lg bg-gray-100 dark:bg-gray-700 rounded-bl-none">
                                    <div className="flex gap-1.5 items-center">
                                        <span className="h-2 w-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.3s]"></span>
                                        <span className="h-2 w-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.15s]"></span>
                                        <span className="h-2 w-2 bg-gray-400 rounded-full animate-pulse"></span>
                                    </div>
                                </div>
                            </div>
                        )}
                        {chatError && !isChatLoading && <div className="text-center text-red-500 text-sm">{chatError}</div>}
                    </div>
                    <div className="p-4 border-t dark:border-gray-700 flex-shrink-0">
                        <form onSubmit={handleSendChatMessage} className="flex items-center gap-2">
                            <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="এখানে প্রশ্ন লিখুন..." className="w-full pl-4 pr-4 py-2 border rounded-full bg-gray-100 dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500" aria-label="আপনার প্রশ্ন" disabled={isChatLoading} />
                            <button type="submit" className="p-3 rounded-full bg-emerald-700 text-white hover:bg-emerald-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 dark:focus:ring-offset-gray-800" aria-label="বার্তা পাঠান" disabled={isChatLoading || !chatInput.trim()}>
                                <PaperAirplaneIcon className="h-5 w-5" />
                            </button>
                        </form>
                    </div>
                </div>
                 {/* FAB */}
                <button onClick={() => setIsChatOpen(!isChatOpen)} className="bg-emerald-700 text-white p-4 rounded-full shadow-lg hover:bg-emerald-800 transition-transform transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 dark:focus:ring-offset-gray-800" aria-label="চ্যাটবট খুলুন">
                    {isChatOpen ? <XIcon className="h-7 w-7" /> : <ModernChatIcon className="h-7 w-7" />}
                </button>
            </div>
        </div>
    );
};

export default App;