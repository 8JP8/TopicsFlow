import { DriveStep } from 'driver.js';

export const getTourSteps = (
    t: (key: string) => string,
    currentPath: string = '/',
    isAdmin: boolean = false,
    navigate?: (path: string) => void
): DriveStep[] => {
    const steps: DriveStep[] = [];

    // Settings Page Tour
    if (currentPath === '/settings') {
        return [
            {
                element: '#settings-tabs', // targeting container instead of just first button if possible
                popover: {
                    title: t('tour.settingsTabsTitle'),
                    description: t('tour.settingsTabsDesc'),
                    side: 'bottom',
                    align: 'start',
                },
            },
            {
                element: '#account-tab-btn',
                popover: {
                    title: t('tour.accountTabTitle') || 'Account Settings',
                    description: t('tour.accountTabDesc') || 'Manage your profile and account details here.',
                    side: 'bottom',
                    align: 'start',
                },
                onHighlightStarted: () => {
                    window.dispatchEvent(new CustomEvent('tour:switch-settings-tab', { detail: 'account' }));
                },
            },
            {
                element: '#edit-profile-btn',
                popover: {
                    title: t('tour.editProfileTitle'),
                    description: t('tour.editProfileDesc'),
                    side: 'bottom',
                    align: 'start',
                },
            },
            {
                element: '#content-safety-group', // Content & Safety Group
                popover: {
                    title: t('tour.contentSafetyTitle'),
                    description: t('tour.contentSafetyDesc'),
                    side: 'bottom',
                    align: 'start',
                },
            }
        ];
    }

    // Dashboard Tour
    if (currentPath === '/') {
        steps.push(
            {
                element: '#sidebar',
                popover: {
                    title: t('tour.sidebarTitle') || 'Navigation Sidebar',
                    description: t('tour.sidebarDesc') || 'Access different topics, your themes, and filter discussions by tags here.',
                    side: 'right',
                    align: 'start',
                },
                onHighlightStarted: () => {
                    window.dispatchEvent(new CustomEvent('tour:switch-mobile-view', { detail: 'sidebar' }));
                    window.dispatchEvent(new CustomEvent('tour:switch-tab', { detail: 'topics' }));
                },
            },
            {
                element: '#topic-search-input',
                popover: {
                    title: t('tour.searchTitle') || 'Search Topics',
                    description: t('tour.searchDesc') || 'Quickly find topics by name or description.',
                    side: 'bottom',
                    align: 'center',
                },
            },
            {
                element: '#topic-sort-select',
                popover: {
                    title: t('tour.sortTitle') || 'Sort Topics',
                    description: t('tour.sortDesc') || 'Sort topics by activity, popularity, or creation date.',
                    side: 'bottom',
                    align: 'center',
                },
            },
            {
                element: '#tags-filter-section',
                popover: {
                    title: t('tour.tagsTitle') || 'Filter by Tags',
                    description: t('tour.tagsDesc') || 'Click on tags to filter topics by category.',
                    side: 'bottom',
                    align: 'start',
                },
            },
            {
                element: '#create-topic-btn',
                popover: {
                    title: t('tour.createTopicTitle') || 'Create Topics',
                    description: t('tour.createTopicDesc') || 'Start your own discussion topic. You can set it to be public or invite-only, and even enable anonymous posting.',
                    side: 'bottom',
                    align: 'start',
                },
            },
            {
                element: '#anonymous-mode-toggle',
                popover: {
                    title: t('tour.anonymousModeTitle') || 'Anonymous Mode',
                    description: t('tour.anonymousModeDesc') || 'Toggle anonymous mode to participate without revealing your identity.',
                    side: 'bottom',
                    align: 'center',
                },
            },
            {
                element: '#invitations-btn',
                popover: {
                    title: t('tour.invitationsTitle') || 'Invitations',
                    description: t('tour.invitationsDesc') || 'Manage your topic and chat invitations here. You can accept or decline invitations from other users.',
                    side: 'bottom',
                    align: 'end',
                },
                // Removed auto-open behavior as requested
            } as any,
            {
                element: '#notification-center-btn',
                popover: {
                    title: t('tour.notificationsTitle') || 'Notifications',
                    description: t('tour.notificationsDesc') || 'Stay updated with mentions, messages, and invites. You can view them all in the dedicated modal.',
                    side: 'bottom',
                    align: 'end',
                },
                // Removed auto-open behavior as requested
            } as any,
            {
                element: '#messages-tab-btn',
                popover: {
                    title: t('tour.messagesTabTitle') || 'Private Messages',
                    description: t('tour.messagesTabDesc') || 'Switch to the messages tab to chat privately with other users.',
                    side: 'right',
                    align: 'center',
                },
                onHighlightStarted: () => {
                    window.dispatchEvent(new CustomEvent('tour:switch-mobile-view', { detail: 'sidebar' }));
                    window.dispatchEvent(new CustomEvent('tour:switch-tab', { detail: 'messages' }));
                },
            } as any,
            {
                element: '#conversations-list',
                popover: {
                    title: t('tour.messagesListTitle') || 'Conversations',
                    description: t('tour.messagesListDesc') || 'Select a conversation to start chatting.',
                    side: 'right',
                    align: 'start',
                },
                onHighlightStarted: () => {
                    window.dispatchEvent(new CustomEvent('tour:switch-mobile-view', { detail: 'sidebar' }));
                    window.dispatchEvent(new CustomEvent('tour:switch-tab', { detail: 'messages' }));
                },
            },
            {
                element: '#message-input-area',
                popover: {
                    title: t('tour.messageInputTitle') || 'Send Message',
                    description: t('tour.messageInputDesc') || 'Type your message, send GIFs, or attach files here.',
                    side: 'top',
                    align: 'center',
                },
                onHighlightStarted: () => {
                    window.dispatchEvent(new CustomEvent('tour:switch-mobile-view', { detail: 'content' }));
                },
            },
            {
                element: '#user-menu-btn',
                popover: {
                    title: t('tour.userMenuTitle') || 'User Menu',
                    description: t('tour.userMenuDesc') || 'Access your settings, profile, and more.',
                    side: 'bottom',
                    align: 'end',
                    onNextClick: () => {
                        window.dispatchEvent(new CustomEvent('tour:open-user-menu'));
                    }
                },
                onHighlightStarted: () => {
                    window.dispatchEvent(new CustomEvent('tour:switch-mobile-view', { detail: 'sidebar' }));
                },
            },
            {
                element: '#user-menu-item-settings',
                popover: {
                    title: t('tour.continueToSettings') || 'Continue to Settings',
                    description: t('tour.continueToSettingsDesc') || 'The tour will now take you to the Settings page. Click Continue to proceed.',
                    side: 'left',
                    align: 'center',
                    nextBtnText: t('tour.continueButton') || 'Continue to Settings',
                    prevBtnText: t('common.previous') || 'Previous',
                    onNextClick: () => {
                        if (navigate) {
                            localStorage.setItem('continue_tour_settings', 'true');
                            navigate('/settings');
                        }
                    }
                },
                onHighlightStarted: () => {
                    // Inject "Close" button logic if needed, or rely on Driver default
                    setTimeout(() => {
                        const footer = document.querySelector('.driver-popover-footer');
                        if (footer && !footer.querySelector('.tour-close-custom-btn')) {
                            const closeBtn = document.createElement('button');
                            closeBtn.innerText = t('common.close') || 'Close';
                            closeBtn.className = 'tour-close-custom-btn driver-popover-close-btn';
                            closeBtn.style.cssText = 'display: inline-block; box-sizing: border-box; padding: 3px 10px; border: 1px solid transparent; border-radius: 3px; text-decoration: none; text-shadow: none; font: 11px / normal sans-serif; cursor: pointer; color: rgb(45, 45, 45); background-color: rgb(241, 241, 241); margin-left: 5px; margin-right: 5px;';
                            const nextBtn = footer.querySelector('.driver-popover-next-btn');
                            if (nextBtn) footer.insertBefore(closeBtn, nextBtn);
                            else footer.appendChild(closeBtn);
                            closeBtn.addEventListener('click', () => window.dispatchEvent(new CustomEvent('tour:end')));
                        }
                    }, 100);
                },
            }
        );

        if (isAdmin) {
            steps.splice(steps.findIndex(s => s.element === '#create-topic-btn') + 1, 0, {
                element: '#admin-dashboard-btn',
                popover: {
                    title: t('tour.adminTitle') || 'Admin Dashboard',
                    description: t('tour.adminDesc') || 'Access moderation tools, reports, and platform statistics.',
                    side: 'bottom',
                    align: 'center',
                },
            });
        }
    }

    return steps;
};

export const tourConfig = {
    showProgress: true,
    animate: true,
    allowClose: true,
    doneBtnText: 'Done', // These will be overridden by step-specific texts or Layout.tsx if it handles it
    closeBtnText: 'Skip',
    nextBtnText: 'Next',
    prevBtnText: 'Previous',
    scrollIntoViewOptions: { block: 'center', inline: 'center' }
};
