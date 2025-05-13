/**
 * Nofollow Link Toggle - WordPress Classic Editor Extension
 * 
 * This script adds a "nofollow" checkbox to the WordPress link dialog
 * and handles applying/removing the nofollow attribute on links.
 * It works entirely on the client-side without requiring server-side processing.
 */
(function () {
  'use strict';

  // Get translatable strings from WordPress localization
  const addNofollowText = window.nltOptions ? window.nltOptions.addNofollowText : 'Add "nofollow" attribute to link';
  const failedToInsertUIText = window.nltOptions ? window.nltOptions.failedToInsertUI : 'Nofollow Link Toggle: Failed to insert UI';

  // State management using a closure to maintain state between dialog interactions
  const nofollowState = {
    isChecked: false,
    isWaiting: false,

    setChecked: function(value) {
      this.isChecked = !!value;
      this.isWaiting = true;
    },

    getChecked: function() {
      return this.isChecked;
    },

    resetWaiting: function() {
      this.isWaiting = false;
    },

    isWaitingForApply: function() {
      return this.isWaiting;
    }
  };

  /**
   * Creates the nofollow UI elements
   * @returns {Object} Object containing the container div and checkbox
   */
  function createNofollowUI() {
    const nofollowDiv = document.createElement('div');
    nofollowDiv.className = 'link-nofollow';
    nofollowDiv.style.marginTop = '6px';

    const label = document.createElement('label');

    // Add empty span (same as in target)
    const span = document.createElement('span');
    span.className = 'wp-link-rel-nofollow';
    label.appendChild(span);
    label.appendChild(document.createTextNode(' '));

    // Create the checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'wp-link-nofollow';
    checkbox.name = 'nofollow';
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(' ' + addNofollowText));

    nofollowDiv.appendChild(label);
    return { container: nofollowDiv, checkbox: checkbox };
  }

  /**
   * Inserts the nofollow UI into the link dialog
   * @returns {HTMLElement|null} The checkbox element or null if insertion failed
   */
  function insertNofollowUI() {
    // Check if already exists to avoid duplicates
    if (document.querySelector('#wp-link-nofollow')) {
      return document.querySelector('#wp-link-nofollow');
    }

    const { container, checkbox } = createNofollowUI();

    // Try to insert after the "target" checkbox
    const targetDiv = document.querySelector('.link-target');
    if (targetDiv && targetDiv.parentNode) {
      targetDiv.parentNode.insertBefore(container, targetDiv.nextSibling);
    } else {
      // Alternative: add to the end of options
      const linkOptions = document.querySelector('#link-options');
      if (linkOptions) {
        linkOptions.appendChild(container);
      } else {
        // Failed to insert
        console.warn(failedToInsertUIText);
        return null;
      }
    }

    return checkbox;
  }

  /**
   * Checks if the current link has nofollow attribute and updates checkbox state
   * @param {Object} editor The TinyMCE editor instance
   * @param {HTMLElement} checkbox The nofollow checkbox element
   */
  function checkIfLinkHasNofollow(editor, checkbox) {
    if (!editor || !checkbox) return;

    // Look for a link either directly or as a parent of selection
    const node = editor.selection.getNode();
    const linkEl = node.nodeName === 'A' ? node : editor.dom.getParent(node, 'A');

    if (linkEl) {
      const rel = linkEl.getAttribute('rel');
      checkbox.checked = rel && rel.includes('nofollow');
    } else {
      // No link selected, uncheck by default
      checkbox.checked = false;
    }
  }

  /**
   * Updates the rel attribute on a link element
   * @param {HTMLElement} element The link element to update
   * @param {boolean} shouldAddNofollow Whether to add nofollow attribute
   */
  function updateRelAttribute(element, shouldAddNofollow) {
    if (!element) return;

    const rel = element.getAttribute('rel') || '';
    const relArray = rel.split(/\s+/).filter(function (part) {
      return part && part !== 'nofollow';
    });

    if (shouldAddNofollow) {
      relArray.push('nofollow');
    }

    if (relArray.length > 0) {
      element.setAttribute('rel', relArray.join(' '));
    } else {
      element.removeAttribute('rel');
    }
  }

  /**
   * Hooks into the wpLink dialog when it's opened
   */
  function setupLinkModal() {
    // Give the modal a moment to fully initialize
    setTimeout(function() {
      const wpLinkWrap = document.querySelector('#wp-link-wrap');
      if (!wpLinkWrap) return;

      const checkbox = insertNofollowUI();
      if (!checkbox) return;

      // Attach event listeners to the checkbox to update our state
      checkbox.addEventListener('change', function() {
        nofollowState.setChecked(checkbox.checked);
      });

      // Check the current link state
      const editor = window.tinymce && window.tinymce.activeEditor;
      if (editor) {
        checkIfLinkHasNofollow(editor, checkbox);

        // Intercept form submission
        const wpLinkSubmit = document.querySelector('#wp-link-submit');
        if (wpLinkSubmit) {
          wpLinkSubmit.addEventListener('mousedown', function() {
            nofollowState.setChecked(checkbox.checked);
          });
        }
      }

      // Also support text editor mode (non-TinyMCE mode)
      const wpLinkClose = document.querySelector('#wp-link-close, #wp-link-cancel');
      if (wpLinkClose) {
        wpLinkClose.addEventListener('mousedown', function() {
          // Reset state when the dialog is closed without saving
          nofollowState.resetWaiting();
        });
      }
    }, 10);
  }

  // Setup MutationObserver to watch for the link modal being added to the DOM
  if (typeof MutationObserver !== 'undefined') {
    const bodyObserver = new MutationObserver(function(mutations) {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) {
              // Check if this is the link modal or contains it
              if ((node.id === 'wp-link-wrap') || (node.querySelector && node.querySelector('#wp-link-wrap'))) {
                setupLinkModal();
                return;
              }
            }
          }
        }
      }
    });

    // Start observing the body for the link modal
    bodyObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Support non-visual editor mode
  // For older WordPress versions that might not use MutationObserver
  jQuery(document).on('wplink-open', function() {
    setupLinkModal();
  });

  // Hook into wpLink's dialog events
  jQuery(document).on('wplink-close', function(e, wrap) {
    // Make sure we've processed any pending updates
    if (nofollowState.isWaitingForApply()) {
      // In text editor mode, we need to intercept the HTML being inserted
      // This is done by the core WordPress wpLink module
      // Our TinyMCE plugin will handle visual editor mode
      if (!window.tinymce || !window.tinymce.activeEditor || window.tinymce.activeEditor.isHidden()) {
        // The state is handled by our TinyMCE plugin
        // We just ensure our state is reset here
        nofollowState.resetWaiting();
      }
    }
  });

  // Add TinyMCE plugin to process links
  if (window.tinymce) {
    window.tinymce.PluginManager.add('nofollow_link_toggle', function(editor) {
      // Process link modifications
      const processLinkAttributes = function() {
        if (!nofollowState.isWaitingForApply()) return;
        
        const linkNode = editor.selection.getNode();
        const linkEl = linkNode.nodeName === 'A' ? linkNode : editor.dom.getParent(linkNode, 'A');
        
        if (linkEl) {
          updateRelAttribute(linkEl, nofollowState.getChecked());
          editor.undoManager.transact(function() {
            // This empty transaction ensures the change is captured in the undo stack
          });
          nofollowState.resetWaiting();
        }
      };

      // Hook into TinyMCE events
      editor.on('init', function() {
        // Watch for the link dialog
        jQuery(document).on('wplink-open', function() {
          setupLinkModal();
        });
      });

      // This event fires when a toolbar (like the link toolbar) appears
      editor.on('wptoolbar', function(e) {
        if (e.element && e.element.nodeName === 'A') {
          processLinkAttributes();
        }
      });

      // This event fires when wpLink updates a link
      editor.on('wplink', function() {
        setTimeout(processLinkAttributes, 10);
      });

      // This event fires when editor content changes
      editor.on('NodeChange', function(e) {
        // If we're waiting to apply a change and we see a link
        const selectedNode = editor.selection.getNode();
        if (selectedNode && (selectedNode.nodeName === 'A' || editor.dom.getParent(selectedNode, 'A'))) {
          processLinkAttributes();
        }
      });

      // Add link autocompletion
      editor.on('preinit', function() {
        if (editor.wp && editor.wp._createToolbar) {
          // Ensure our nofollow setting persists when using the inline link toolbar
          const oldCreateToolbar = editor.wp._createToolbar;
          editor.wp._createToolbar = function(name, entities, args) {
            const toolbar = oldCreateToolbar.call(this, name, entities, args);
            if (name === 'link' && toolbar) {
              toolbar.on('show', function() {
                setTimeout(function() {
                  const linkNode = editor.selection.getNode();
                  const linkEl = linkNode.nodeName === 'A' ? linkNode : editor.dom.getParent(linkNode, 'A');
                  
                  if (linkEl && nofollowState.isWaitingForApply()) {
                    updateRelAttribute(linkEl, nofollowState.getChecked());
                    nofollowState.resetWaiting();
                  }
                }, 10);
              });
            }
            return toolbar;
          };
        }
      });
    });
  }

  // Initialize when a document is ready to handle both Classic Editor and standalone wpLink usage
  jQuery(document).ready(function($) {
    // When the wpLink dialog is opened
    $(document).on('wplink-open', function() {
      setupLinkModal();
    });

    // Check if we're in Gutenberg/Block Editor, and if so, don't initialize
    // This prevents potential conflicts with block editor link handling
    if (document.body.classList.contains('block-editor-page')) {
      // This is the block editor, so we don't need to run our code
      return;
    }

    // If the dialog is already present when we load (a rare edge case)
    if (document.querySelector('#wp-link-wrap')) {
      setupLinkModal();
    }
  });
})();
