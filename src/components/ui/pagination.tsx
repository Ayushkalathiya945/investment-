"use client";

import { Button } from "@/components/ui/button";

type PaginationProps = {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
};

export function Pagination({
    currentPage,
    totalPages,
    onPageChange,
}: PaginationProps) {
    // Generate page numbers to display
    const getPageNumbers = () => {
        const pages = [];
        const maxPagesToShow = 5;

        if (totalPages <= maxPagesToShow) {
            // Show all pages if total pages is less than max pages to show
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
            return pages;
        } else {
            // For larger page counts, use a more complex display logic
            // Calculate start and end of page range
            let start = Math.max(2, currentPage - 1);
            let end = Math.min(totalPages - 1, currentPage + 1);

            // Adjust if at the beginning
            if (currentPage <= 2) {
                end = Math.min(4, totalPages - 1);
            }

            // Adjust if at the end
            if (currentPage >= totalPages - 1) {
                start = Math.max(2, totalPages - 3);
            }

            // Add ellipsis if needed
            if (start > 2) {
                pages.push("ellipsis-start");
            }

            // Add page numbers
            for (let i = start; i <= end; i++) {
                pages.push(i);
            }

            // Add ellipsis if needed
            if (end < totalPages - 1) {
                pages.push("ellipsis-end");
            }

            return pages;
        }
    };

    const pageNumbers = getPageNumbers();

    return (
        <div className="flex items-center justify-center space-x-2">
            {/* First page button */}
            {/* <Button
                variant="outline"
                size="icon"
                onClick={() => onPageChange(1)}
                disabled={currentPage === 1}
                className="hidden sm:flex"
            >
                <ChevronsLeft className="h-4 w-4" />
                <span className="sr-only">First page</span>
            </Button> */}

            {/* Previous page button */}
            <Button
                variant="ghost"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
            >
                Previous
            </Button>

            {/* Page numbers */}
            {totalPages <= 5
                ? (
                        pageNumbers.map(page => (
                            <Button
                                key={`page-${page}`}
                                variant={currentPage === page ? "default" : "outline"}
                                size="sm"
                                onClick={() => onPageChange(page as number)}
                                className="w-9 border-none"
                            >
                                {page}
                            </Button>
                        ))
                    )
                : (
                    // Complex pagination for more than 5 pages
                        <>
                            {/* First page */}
                            <Button
                                variant={currentPage === 1 ? "default" : "outline"}
                                size="sm"
                                onClick={() => onPageChange(1)}
                                className="w-9"
                            >
                                1
                            </Button>

                            {/* Middle pages with ellipsis */}
                            {pageNumbers.map((page, index) => {
                                if (
                                    page === "ellipsis-start"
                                    || page === "ellipsis-end"
                                ) {
                                    return (
                                        <span key={`${page}-${index}`} className="px-2">
                                            ...
                                        </span>
                                    );
                                }
                                return (
                                    <Button
                                        key={`page-${page}-${index}`}
                                        variant={
                                            currentPage === page ? "default" : "outline"
                                        }
                                        size="sm"
                                        onClick={() =>
                                            typeof page === "number"
                                            && onPageChange(page)}
                                        className="w-9"
                                    >
                                        {page}
                                    </Button>
                                );
                            })}

                            {/* Last page */}
                            <Button
                                variant={
                                    currentPage === totalPages ? "default" : "outline"
                                }
                                size="sm"
                                onClick={() => onPageChange(totalPages)}
                                className="w-9"
                            >
                                {totalPages}
                            </Button>
                        </>
                    )}

            {/* Next page button */}
            <Button
                variant="ghost"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
            >
                Next
            </Button>

            {/* Last page button */}
            {/* <Button
                variant="outline"
                size="icon"
                onClick={() => onPageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="hidden sm:flex"
            >
                <ChevronsRight className="h-4 w-4" />
                <span className="sr-only">Last page</span>
            </Button> */}
        </div>
    );
}
