window.SearchSpringInit = function() {
var self = this;

if (self.context.category && typeof self.context.category == 'string') {
    // Set background filter
    self.context.backgroundFilters.category = self.context.category;
}

// springboard generated variables
var modules = {};
modules.enabled = true;

// springboard generated variables for autocomplete/default
modules['autocomplete'] = {
	input: '.search-widget .search-widget__input',
	spellCorrection: true,
	language: 'en',
	action: '',
	autoPosition: false,
	limit: 6
};

this.importer.include('autocomplete2', modules.autocomplete);


this.importer.include('compare');




this.on('afterSearch', function($scope) {
	angular.forEach($scope.facets, function(facet) {
		// Create different limits for different facet types
		// For palette and grid types, this makes sure boxes fill the last row
		var facetType = (facet.type == 'palette' || facet.type == 'grid') ? true : false;
		facet.limitCount = facetType ? 16 : 12;
	});
});


self = this;

var huyett = {
	showSort: false,
	showPerPage: false,
	isSearchPage: false
};

// TODO: For testing custom event listeners, remove later
window.addEventListener('ss.huyett.afterBootstrap', function(e){
	console.log('afterBootstrap custom event: ', e.detail);
});

window.addEventListener('ss.huyett.afterSearch', function(e) {
	console.log('afterSearch custom event: ', e.detail);
});

this.on('domReady', function() {
	var contentContainer = document.querySelector('.ss-content-results');

	// Only emit dom ready event if not showing content results
	if (!contentContainer) {
		window.dispatchEvent(new CustomEvent('ss.huyett.domReady', {}));
	}
});

if ( self.context.customerid && typeof self.context.customerid == 'string' ) {
	// Add customer ID to helper obj, used to display customer specific SKUs
	huyett.customerID = self.context.customerid;
}

this.on('afterBootstrap', function($scope) {
	$scope.$watch('ac.visible', function(visible) {
		// Functionality needed for AC to show in mobile search form
		if ( visible && lessThanBp(1099) ) {
			self.utils.ensure(function() {
				// Ensure we have our search container and that AC is rendered on the page for accurate height
				return document.querySelector('.header-row__container .header-row__toggle.show[data-header-row-toggle]') && document.querySelector('div[ss-autocomplete]').clientHeight > 0;
			}, function() {
				var searchContainer = document.querySelector('.header-row__container .header-row__toggle[data-header-row-toggle]');
				var autocompleteHeight = document.querySelector('div[ss-autocomplete]').clientHeight;
				searchContainer.style.overflowY = 'scroll';

				// Increase height of container so AC is shown
				searchContainer.style.height = 90 + autocompleteHeight + 'px';
			});
		} else {
			// If AC has been hidden, remove custom styles
			self.utils.ensure(function() {
				return document.querySelector('.header-row__container .header-row__toggle[data-header-row-toggle]');
			}, function() {
				var searchContainer = document.querySelector('.header-row__container .header-row__toggle[data-header-row-toggle]');
				searchContainer.removeAttribute('style');
			});
		}
	});
	
	$scope.$watch('subsearch.noResults.pagination.totalResults', function(total) {
        if (total > 0 && $scope.pagination.totalResults == 0) {
            self.utils.ensure(function() {
                return document.querySelector('.loading-container-plp-searchspring');
            }, function() {
                var loadingContainer = document.querySelector('.loading-container-plp-searchspring');
                loadingContainer.remove();
            });
        }
    });
	
	// Set helper obj to scope
	$scope.huyett = huyett;

	// Toggle sort dropdown
	$scope.huyett.toggleSort = function(e) {
		e.stopPropagation();
		$scope.huyett.showSort = !$scope.huyett.showSort;
		$scope.huyett.showPerPage = false;
	}

	// Toggle per page dropdown
	$scope.huyett.togglePerPage = function(e) {
		e.stopPropagation();
		$scope.huyett.showPerPage = !$scope.huyett.showPerPage;
		$scope.huyett.showSort = false;
	}

	// Select sort dropdown option, used on-click
	$scope.huyett.handleSelectOption = function(option) {
		$scope.huyett.showSort = false;
		option.go();
	}

	$scope.huyett.handleSelectPerPage = function(n) {
		$scope.huyett.showPerPage = false;
		$scope.pagination.perPage = n;
	}

	// Toggle dropdown option highlighting on mouseenter/mouseleave
	$scope.huyett.toggleOptionHighlighting = function(e) {
		var parent = $scope.utilities.findAncestor(e.target, 'select2-result select2-result-selectable');

		if ( parent ) {
			var classListArray = [].slice.call(parent.classList);
			var active = classListArray.indexOf('select2-highlighted') >= 0;

			active ? parent.classList.remove('select2-highlighted') : parent.classList.add('select2-highlighted');
		}
	}

	// Search within product results
	$scope.huyett.handleSearchWithinResults = function() {
		$scope.location().remove('page').remove('rq').add('rq', $scope.query.rq).go()
		$scope.query.rq = '';
	}

	// Search within dropdown options
	$scope.huyett.searchWithinDropdown = function(e, type) {
		var query = e.target.value;

		// If there's no query, remove filtered options
		if ( query == '' && type == 'sort' && $scope.sorting.filteredOptions && $scope.sorting.filteredOptions.length ) {
			// No query, reset sort dropdown
			delete $scope.sorting.filteredOptions;
			return;
		} else if (
			query == '' &&
			type == 'perPage' &&
			$scope.huyett.filteredPerPageOptions &&
			$scope.huyett.filteredPerPageOptions.length
		) {
			// No query, reset per page dropdown
			delete $scope.huyett.filteredPerPageOptions;
			return;
		} else if ( query == '' ) {
			// No query, discontinue
			return;
		}

		if ( type == 'sort' ) {
			handleSearchWithinSort($scope, query);
		} else if ( type == 'perPage' ) {
			handleSearchWithinPerPage($scope, query);
		}
	}
	
	// Saves collapsed state of content tab filters to localStorage
	$scope.huyett.saveFilterState = function(filter, collapsed, curTab) {
		if (curTab !== 'content') return;

		var name = filter.label.toLowerCase(); 
		var storageProp = name + '-' + curTab;
		localStorage.setItem(storageProp, collapsed);
	}

	// On load reset saved state for content category filter
	localStorage.setItem('category-content', false);

	// Change view layouts
	$scope.layout = getStoredView();

	$scope.swapLayout = function(view) {
		$scope.layout = view;
		setStoredView(view);
	}

	// Emit custom afterBootstrap event
	if ( !$scope.moduleName ) {
		// Check URL for content URL params before emitting event
		self.utils.ensure(function() {
			return window && typeof window == 'object';	
		}, function() {
			var isContentTab = window.location.hash.indexOf('results:content') >= 0;
			
			if (!isContentTab) {
				console.log('emitting after boot...');
				window.dispatchEvent(new CustomEvent('ss.huyett.afterBootstrap', {
					detail : $scope
				}));				
			}
		});
	}

	// Close dropdowns on document click
	self.utils.ensure(function() {
		return document && typeof document == 'object';
	}, function() {
		document.addEventListener('click', function() {
			$scope.huyett.showSort = false;
			$scope.huyett.showPerPage = false;
		});
	});
	
	// Check if current page is search page
	self.utils.ensure(function() {
		return window && typeof window == 'object';
	}, function() {
		var pagePath = window.location.pathname;
		var isMockup = pagePath.indexOf('mockup.html') >= 0;
		var isSearch = pagePath.indexOf('product/search') >= 0;

		if (isMockup || isSearch) {
			// Update scope flag, used to show content tabs
			$scope.huyett.isSearchPage = true;
		}	
	});
});

// Set layout initially
this.on('afterSearch', function ($scope) {
	$scope.layout = getStoredView();

	return self.on.UNBIND;
});

// Remove huyett recommendations on no results page
this.on('afterSearch', function($scope) {
    if ($scope.results.length == 0) {
        self.utils.ensure(function() {
            return document.querySelector('.loading-container-plp-searchspring');
        }, function() {
            var loadingContainer = document.querySelector('.loading-container-plp-searchspring');
            loadingContainer.remove();
        });
    } 
});

this.on('afterSearch', function($scope) {
	// Passed into custom event
	var productIDs = [];

	// Check if there is more than one page (for head title logic)
	$scope.pagination.multiplePages = true;
	if ($scope.pagination.totalResults <= $scope.pagination.perPage) {
		$scope.pagination.multiplePages = false;
	}

	// Set default image url
	$scope.results.defaultImage = '//cdn.searchspring.net/ajax_search/img/default_image.png';

	angular.forEach($scope.results, function(result) {
		// If no thumbnail image, set default image
		if (!result.thumbnailImageUrl) {
			result.thumbnailImageUrl = $scope.results.defaultImage;
		}

		// Pre-load images and check for loading errors
		var ssResultsImage = new Image();
		ssResultsImage.src = result.thumbnailImageUrl;

		// If image errors, load default image instead
		ssResultsImage.onerror = function() {
			result.thumbnailImageUrl = $scope.results.defaultImage;
			$scope.$evalAsync();
		}

		// Build array of result uids
		if ( result.uid ) {
			productIDs.push('#product-id-' + result.uid);
		}
	});

	// Emit custom after search event
	if (
		!$scope.moduleName &&
		(!$scope.huyett.isSearchPage || ($scope.huyett.isSearchPage && $scope.tabs.current !== 'content'))
	) {
		console.log('emitting after search event...');
		window.dispatchEvent(new CustomEvent('ss.huyett.afterSearch', {
			detail : {
				scope: $scope,
				ids: productIDs
			}
		}));
	}
});

this.on('afterSearch', function($scope) {
	// Check if there is more than one page (for head title logic)
	$scope.pagination.multiplePages = true;
	if ($scope.pagination.totalResults <= $scope.pagination.perPage) {
		$scope.pagination.multiplePages = false;
	}

	// Set default image url
	$scope.results.defaultImage = '//cdn.searchspring.net/ajax_search/img/default_image.png';

	angular.forEach($scope.results, function(result) {
		// If no thumbnail image, set default image
		if (!result.thumbnailImageUrl) {
			result.thumbnailImageUrl = $scope.results.defaultImage;
		}

		// Pre-load images and check for loading errors
		var ssResultsImage = new Image();
		ssResultsImage.src = result.thumbnailImageUrl;

		// If image errors, load default image instead
		ssResultsImage.onerror = function() {
			result.thumbnailImageUrl = $scope.results.defaultImage;
			$scope.$evalAsync();
		}

		// If customer ID exists, parse customer SKUs if available
		if ( !$scope.moduleName && $scope.huyett.customerID && result.customer_part_numbers ) {
			try {
				var parsedPartNumbers = JSON.parse(result.customer_part_numbers);
				var customerPartNumber = parsedPartNumbers[Number($scope.huyett.customerID)];
				result.customerPartNumber = customerPartNumber;
			} catch(e) {
				//console.error('Error parsing customer part numbers...');
			}
		}
	});
});

// Search within results
this.on('afterSearch', function($scope) {
  // workaround for rq and filterSummary
  // first check if rq is in filterSummary
  var addCrumb = true;
  angular.forEach($scope.filterSummary, function(summary) {
	if (summary.field == 'rq') addCrumb = false;
  });
  // then add crumb to summary if not in filterSummary
  if (addCrumb) {
	angular.forEach($scope.breadcrumbs, function(crumb) {
	  if (crumb.filterLabel == 'Refinement') {
		var fsCrumb = crumb;
		fsCrumb.filterValue = 'Search: \'' + crumb.filterValue + '\'';
		fsCrumb.value = crumb.filterValue;
		fsCrumb.field = 'rq';
		fsCrumb.remove = {};
		fsCrumb.remove.location = $scope.location();
		fsCrumb.remove.go = function() {
		  fsCrumb.remove.location.remove('rq').go();
		}
		fsCrumb.remove.url = fsCrumb.remove.location.remove('rq').url();
		$scope.filterSummary.push(fsCrumb);
	  }
	});
  }
});

this.on('afterSearch', function($scope) {
	// Add inline merchandising banners
	if ($scope.pagination.totalResults && $scope.merchandising.content.inline) {
		// Variables for banner positions beyond pagination index
		var tailBanners = [];
		var bannerBegin = $scope.pagination.begin - 1;
		var bannerEnd = $scope.pagination.end;

		$scope.merchandising.content.inline.sort(function(a, b) {
			return a.config.position.index - b.config.position.index;
		}).filter(function(banner) {
			var index = banner.config.position.index;

			if (index >= bannerBegin) {
				if (index <= bannerEnd - 1) {
					return true;
				} else {
					tailBanners.push(bannerToResult(banner));
				}
			}
		}).map(function(banner) {
			var adjustedIndex = $scope.infinite ? banner.config.position.index : (banner.config.position.index - bannerBegin);
			$scope.results.splice(adjustedIndex, 0, bannerToResult(banner));
		});

		var missingBegin = $scope.infinite ? 0 : bannerBegin;
		var totalResults = Math.min($scope.pagination.totalResults, bannerEnd);
		var missingResults = totalResults - (missingBegin + $scope.results.length);

		if (missingResults) {
			var sliceStart = ($scope.pagination.nextPage == 0) ? (tailBanners.length - missingResults) : 0;
			var missingBanners = tailBanners.slice(sliceStart, sliceStart + missingResults);
			angular.forEach(missingBanners, function(missingBanner) {
				$scope.results.push(missingBanner);
			});
		}
	}
});

// Move around elements on no results page to maintain sidebar
this.on('afterSearch', function($scope) {
	if ($scope.results.length == 0) {
		var sidebar = document.querySelector('aside.page-sidebar');
		var content = document.querySelector('div#searchspring-content');
		var mainContainer = document.querySelector('section.page-content.page-content--has-sidebar');
		
		if (sidebar && content && mainContainer) {
			var customContainer = document.createElement('div');
			customContainer.className = 'ss-no-results-grid';
			customContainer.appendChild(sidebar);
			customContainer.appendChild(content);

			if (customContainer.children.length == 2) {
				mainContainer.insertBefore(customContainer, mainContainer.firstChild);
			}
		}
	}
});

// --- START CONTENT TAB LOGIC

// Create tabs object
var tabs = {
	default  : 'products',
	location : '',
	current  : 'products',
	previous : 'products',
	ac		 : {
		current  : 'products',
		previous : 'products'
	},
	values	 : [
		{
			label  : 'Products',
			name   : 'products',
			siteid : window.location.hostname != "huyett-stage.oro-cloud.com" ? 'b2a017' : '82bqmz',
			order  : 1,
			class  : 'ss-has-products'
		},
		{
			label  : 'Content',
			name   : 'content',
			siteid : window.location.hostname != "huyett-stage.oro-cloud.com" ? 'cktpv1' : 'y4m8j0',
			order  : 2,
			class  : 'ss-has-content'
		}
	],
	getTab	 : function(name) {
		var tab = this.values.filter(function(tab) { return tab.name == name; }).pop();
		return tab;
	}
};


this.on('afterBootstrap', function($scope) {
	// Click function for "See More Results" in autocomplete
	$scope.acSeeMore = function(currentTab) {
		var acSeeMoreLocation = $scope.ac.location.remove('perpage').remove('results');
		if (currentTab == 'content') {
			acSeeMoreLocation = acSeeMoreLocation.add('results', currentTab);
		}
		acSeeMoreLocation.go();
	}

	// Create a didYouMean link
	$scope.didYouMeanClick = function() {
		$scope.location().remove(self.context.search).add(self.context.search, $scope.didYouMean.query).go();
	}
	
	// Update tab location and set tabs to scope
	tabs.location = $scope.location;
	$scope.tabs = tabs;

	// Update tab details when the tab is switched
	$scope.tabs.changeTab = function(name, autocomplete) {
		// Getting the tab with the name that's passed in
		var tab = tabs.getTab(name);

		// Check if there are tabs
		if (tab) {
			// Update tab details for autocomplete in certain conditions
			if ((!autocomplete && !$scope.ac.input) || autocomplete) {
				this.ac.previous = this.ac.current;
				this.ac.current = name;
				$scope.ac.options.siteid = tab.siteid;
			}

			// Update autocomplete display if location is available
			if (autocomplete && $scope.ac.location) {
				$scope.ac.location.remove(self.context.search).remove('filter');
				$scope.ac.results = [];
				$scope.ac.update();
			}

			// Change search results tab information when not in autocomplete
			if (!autocomplete) {
				this.previous = this.current;
				this.current = name;

				if (this.current != this.previous) {
					// Reset location and remove filters if tabs have changes
					var resultsLocation = $scope.location().remove('results').remove('sort').remove('page').remove('filter');
					resultsLocation = (this.current == 'content') ? resultsLocation.add('results', name) : resultsLocation;
					resultsLocation.go();

					// Reset search form and results
					swapTabClasses(name);
					updateSearchForms(name);
					$scope.results = [];
				}
			}
			
			// Go through all facets and close the dropdown
			function closeFilters() {
				if ($scope.facets.length > 0) {
					angular.forEach($scope.facets, function(facet) {
						facet.collapse = true;
					});
				}
			}
			
			// Get stored collapsed state for given filter
			function getFilterState(filterName, curTab) {
				var storageProp = filterName.toLowerCase() + '-' + curTab;
				var state = localStorage.getItem(storageProp);

				return state;
			}

			// Make sure product facets are closed when switching back to products
			// Does not affect content tab filters, state will be remembered
			if (tab.name === 'content' && this.previous == 'products') {
				closeFilters();

				self.utils.ensure(function() {
					return $scope.tabs.current == 'content' && $scope.facets.length == 1;
				}, function() {
					var categoryFilter = $scope.facets.get('category');
					var state = getFilterState('category', 'content');
					
					if (categoryFilter.length) {
						// If we have cat filter, grab it from array
						categoryFilter = categoryFilter[0];
					} else {
						// If theres no category filter discontinue
						return;
					}

					if (state == 'true') {
						// Collapse filter if previous state was collapsed
						$scope.facets[0].collapse = true;
					} else if (state !== null) {
						// Open filter if previous state was opened
						$scope.facets[0].collapse = false;
					}
				});
			} else if (tab.name == 'products' && this.previous == 'content'){
				// Make sure product cat filter is collapsed
				setTimeout(function() {
					$scope.$apply(function() {
						var categoryFilter = $scope.facets.get('category');

						if (categoryFilter.length) {
							categoryFilter[0].collapse = true;
						}
					})
				}, 500);
			}
		}
	};

	self.on('beforeSearch', function(req, config) {
		if (config.moduleName == 'subsearch') {
			return;
		}

		// Check if we are in a module (like autocomplete)
		if (config.moduleName == 'autocomplete2') {
			// Getting the tab with the name equal to hash name in the url
			var tab = tabs.getTab(tabs.ac.current);

			// If there's a tab, set the siteid
			if (tab) {
				req.siteId = tab.siteid;
				updateSearchForms(tab.name);
			}
		} else {
			// Set resultsTabName to tabs.default
			var resultsTabName = tabs.default;

			// Get location of the result set
			var resultSet = tabs.location().get('results');

			// If there is a hash, use it to change resultsTabName
			if (resultSet.length && resultSet[0][1] && (resultSet[0][1] != tabs.default)) {
				resultsTabName = resultSet[0][1];
			}

			// Update results and autocomplete current tab
			tabs.current = resultsTabName;
			if (!$scope.ac.input) {
				tabs.ac.current = resultsTabName;
			}

			// Get the tab with the name equal to resultsTabName
			var tab = tabs.getTab(resultsTabName);

			// If there's a tab, update details
			if (tab) {
				req.siteId = tab.siteid;
				$scope.ac.options.siteid = tab.siteid;
				swapTabClasses(tab.name);
				updateSearchForms(tab.name);
			}
		}
	});
});

this.on('afterSearch', function($scope) {
	// Override visibility for autocomplete when tabs are selected
	if ($scope.moduleName == 'autocomplete2') {
		$scope.visibilityOverride = function() {
			return true;
		}
	}
});

// Check if other content tabs have results to update no results content
this.importer.include('subsearch', {
	identifier : 'noResults',
	siteId	   : 'cktpv1'
});

this.on('afterSearch', function($scope) {
	if (!$scope.moduleName && $scope.q && $scope.pagination.totalResults === 0) {
		var noResultsSiteId = (tabs.current == 'products') ? tabs.getTab('content').siteid : tabs.getTab('products').siteid;

		// Update details for subsearch and then perform subsearch
		$scope.subsearch.noResults.suboptions.siteId = noResultsSiteId;
		$scope.subsearch.noResults.suboptions.q = $scope.q;
		$scope.subsearch.noResults.search();
	}
});

// Update the form action depending on what tab is selected
function updateSearchForms(tabName) {
	// Change the action on the actual search form
	var searchInputs = angular.element(document.querySelectorAll('.your-autocomplete-input-selector'));

	if (searchInputs && searchInputs.length) {
		for (var i = 0; i < searchInputs.length; i++) {
			var searchForm = angular.element(searchInputs[i].form);

			if (searchForm && searchForm.length) {
				var resultsParam = '#results:';
				var searchFormAction = (searchForm.attr('action').split(resultsParam)[0]) + (tabName == 'content' ? (resultsParam + tabName) : '');
				searchForm.attr('action', searchFormAction);
			}
		}
	}
}

// Add classes for products and content
function swapTabClasses(tabName) {
	var bodySelector = angular.element(document.querySelectorAll('body')[0]);
	if (bodySelector && bodySelector.length) {
		var tabValues = tabs.values;
		for (var tab in tabValues) {
			var currentTab = tabValues[tab];
			if (currentTab.name == tabName) {
				bodySelector.addClass(currentTab.class);
			} else {
				bodySelector.removeClass(currentTab.class);
			}
		}
	}
}

// --- END CONTENT TAB LOGIC

function getStoredView() {
	var view = 'grid';

	if (typeof(Storage) !== 'undefined') {
		view = window.localStorage['ss-view'];
	}

	if (view == 'grid' || view == 'list') {
		return view;
	} else {
		return 'grid';
	}
}

function setStoredView(view) {
	if (typeof(Storage) !== 'undefined') {
		window.localStorage.setItem('ss-view', view);
	}
}

function handleSearchWithinSort(scope, query) {
	var filteredResults = [];
	angular.forEach(scope.sorting.options, function(option) {
		var label = option.label.toLowerCase();

		// If option includes query, push to filtered results
		if ( label.indexOf(query.toLowerCase()) >= 0 ) {
			filteredResults.push(option);
		}
	});

	if ( filteredResults.length ) {
		// We have filtered results, update scope
		scope.sorting.filteredOptions = filteredResults;
	} else if ( scope.sorting.filteredOptions && scope.sorting.filteredOptions.length ) {
		// We have no results, show all options
		delete scope.sorting.filteredOptions;
	}
}

function handleSearchWithinPerPage(scope, query) {
	// Note: Update this array if per page options change in results.html
	var perPageOptions = ['12', '24', '36'];
	var filteredResults = [];

	for ( var i = 0; i < perPageOptions.length; i++ ) {
		if ( perPageOptions[i].indexOf(query.toLowerCase()) >= 0 ) {
			// Option includes query, push to filtered results
			filteredResults.push(perPageOptions[i]);
		}
	}

	if ( filteredResults.length ) {
		// We have filtered results, update state
		scope.huyett.filteredPerPageOptions = filteredResults;
	} else if ( scope.huyett.filteredPerPageOptions && scope.huyett.filteredPerPageOptions.length ) {
		// We have no results, show all options
		delete scope.huyett.filteredPerPageOptions;
	}
}

function bannerToResult(banner) {
	return {
		uid			   : 'ssib-' + banner.config.position.index,
		isInlineBanner : true,
		content		   : banner.value
	}
}

// Check cur viewport width is less than BP
function lessThanBp(bp) {
	var widthCalc = (window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth);
	return widthCalc <= bp;
}


// springboard generated variables for slideout/default
modules['slideout'] = {
	width: 1099
};

this.importer.include('slideout', modules.slideout);


this.on('afterBootstrap', function($scope) {
	$scope.utilities = $scope.utilities || {};

	// Helper function to find ancestors / parents... e = element, c = class
	if ($scope.utilities) {
		$scope.utilities.findAncestor = function(e, c) {
			while (e) { if (e.className && e.className.indexOf(c) !== -1) { return e; } e = e.parentNode; } return null;
		};

		// Dropdown object with toggle functionality
		$scope.utilities.dropdown = {
			expandedClass : 'ss-expanded',
			dropdownClass : 'ss-dropdown-menu',
			removeClasses : function() {
				angular.element(document.querySelectorAll('.' + this.dropdownClass + '.' + this.expandedClass)).removeClass(this.expandedClass);
			},
			show : function(e) {
				e.stopPropagation();
				var dropdownMenu = angular.element($scope.utilities.findAncestor((e.target || e.srcElement), this.dropdownClass));
				if (dropdownMenu.hasClass(this.expandedClass)) {
					this.removeClasses();
				} else {
					this.removeClasses();
					dropdownMenu.addClass(this.expandedClass);
				}
			}
		};

		// Close elements if clicked outside
		angular.element(document).on('click', function() {
			$scope.utilities.dropdown.removeClasses();
		});
	}
});
};
SearchSpring.Catalog.templates.promises.receive.resolve('<!-- Stylesheet --><link rel="stylesheet" href="//cdn.searchspring.net/ajax_search/sites/b2a017/css/b2a017.css"><!-- AutoComplete --><script type="text/ss-template" name="AutoComplete" target="[ss-autocomplete]">	<div class="ss-ac-container ss-flex-wrap" ng-show="ac.visible" ng-class="{\'no-terms\': ac.terms.length == 0}">		<div class="ss-ac-terms" ng-show="ac.terms">			<div class="ss-ac-tabs">				<div class="ss-list">					<div class="ss-list-option ss-tab-option" ng-class="{\'ss-active\': tabs.ac.current == \'products\'}">						<a ss-no-ps ss-nav-selectable ng-focus="tabs.changeTab(\'products\', true)" ng-click="tabs.changeTab(\'products\', true)" class="ss-list-link ss-ac-tab-link ss-pointer">Products</a>					</div>					<div ng-if="tabs.ac.current == \'products\'" ng-repeat="term in ac.terms | limitTo:4" class="ss-list-option" ng-class="{\'ss-active\': term.active}">						<a ng-bind-html="term.label | trusted" ss-no-ps ss-nav-selectable ng-focus="term.preview()" href="{{ term.url + (tabs.ac.current == \'content\' ? (\'#results:\' + tabs.ac.current) : \'\') }}" class="ss-list-link"></a>					</div>					<div class="ss-list-option ss-tab-option" ng-class="{\'ss-active\': tabs.ac.current == \'content\'}">						<a ss-no-ps ss-nav-selectable ng-focus="tabs.changeTab(\'content\', true)" ng-click="tabs.changeTab(\'content\', true)" class="ss-list-link ss-ac-tab-link ss-pointer">Content</a>					</div>					<div ng-if="tabs.ac.current == \'content\'" ng-repeat="term in ac.terms | limitTo:4" class="ss-list-option" ng-class="{\'ss-active\': term.active}">						<a ng-bind-html="term.label | trusted" ss-no-ps ss-nav-selectable ng-focus="term.preview()" href="{{ term.url + (tabs.ac.current == \'content\' ? (\'#results:\' + tabs.ac.current) : \'\') }}" class="ss-list-link"></a>					</div>				</div>			</div>		</div>		<div class="ss-ac-facets" ng-show="ac.facets">			<div class="ss-ac-facets-row">				<div ng-repeat="facet in ac.facets | filter:{ type: \'!slider\' } | limitTo:3" ng-switch="facet.type" ng-if="facet.values.length" id="ss-ac-{{ facet.field }}" class="ss-ac-facet-container ss-ac-facet-container-{{ (facet.type && (facet.type != \'hierarchy\' || facet.type != \'slider\')) ? facet.type : \'list\' }}">					<h4 class="ss-title">{{ facet.label }}</h4>					<div ng-switch-default class="ss-list">						<div ng-repeat="value in facet.values | limitTo:4" class="ss-list-option" ng-class="{\'ss-active\': value.active}">							<a href="{{ value.url + (tabs.ac.current == \'content\' ? (\'/results:\' + tabs.ac.current) : \'\') }}" ss-no-ps ss-nav-selectable ng-focus="value.preview()" class="ss-list-link">								{{ value.label }}							</a>						</div>					</div>				</div>			</div>			<div ng-if="ac.merchandising.content.left.length > 0" id="ss-ac-merch-left" class="ss-ac-merchandising" ss-merchandising="ac.left"></div>		</div>		<div class="ss-ac-results">			<h4 class="ss-title ss-ac-results-title">{{ tabs.ac.current == \'products\' ? \'Product\' : \'Content\' }} Suggestions</h4>			<div ng-if="ac.merchandising.content.header.length > 0" id="ss-ac-merch-header" class="ss-ac-merchandising" ss-merchandising="ac.header"></div>			<div ng-if="ac.merchandising.content.banner.length > 0" id="ss-ac-merch-banner" class="ss-ac-merchandising" ss-merchandising="ac.banner"></div>			<div ng-if="ac.results.length" class="ss-ac-item-container ss-flex-wrap">				<article class="ss-ac-item" ng-repeat="result in ac.results | limitTo:ac.pagination.perPage">					<div ng-if="result.isInlineBanner" class="ss-inline-banner" ng-bind-html="result.content | trusted"></div>					<a ng-if="!result.isInlineBanner" ng-href="{{ result.url }}" ss-no-ps ss-nav-selectable>						<div class="ss-ac-item-image" ng-if="tabs.ac.current == \'products\'">							<div class="ss-image-wrapper" ng-style="{\'background-image\': \'url(\' + result.thumbnailImageUrl + \')\'}" alt="{{ result.name }}" title="{{ result.name }}"></div>						</div>						<div class="ss-ac-item-details">							<p class="ss-ac-item-name">{{ result.name | truncate:40:\'&hellip;\' }}</p>							<p ng-if="tabs.ac.current == \'products\'" class="ss-ac-sku">{{ result.customerPartNumber ? result.customerPartNumber : result.sku }}</p>						</div>					</a>				</article>			</div>			<div ng-if="!ac.results.length" class="ss-ac-no-results">				<p>No results found for "{{ ac.q }}". Please try another search.</p>			</div>			<div ng-if="ac.merchandising.content.footer.length > 0" id="ss-ac-merch-footer" class="ss-ac-merchandising" ss-merchandising="ac.footer"></div>			<div ng-if="ac.results.length" class="ss-ac-see-more">				<a ng-click="acSeeMore(tabs.ac.current); ac.visible = false;" class="ss-ac-see-more-link ss-title" ss-nav-selectable>					See {{ ac.pagination.totalResults }} {{ ac.breadcrumbs.length > 1 ? \'filtered\' : \'\' }} result{{ ac.pagination.totalResults > 1 ? \'s\' : \'\' }} for "{{ ac.q }}"				</a>			</div>		</div>	</div></script><!-- Compare - Button --><script type="text/ss-template" name="Compare - Button" target=".ss-compare-item-button">	<a ng-if="!compare.full && !compare.has(result)" ng-click="compare.toggle(result)" class="ss-compare-button ss-pointer ss-add btn btn--block btn-main btn--info" alt="Compare Product">		<span class="ss-compare-button-label">Compare Product</span>	</a>	<a ng-if="compare.has(result)" ng-click="compare.toggle(result)" class="ss-compare-button ss-pointer ss-active btn btn--block btn-main btn--info" alt="Added to Compare">		<span class="ss-compare-button-label">Added to Compare</span>	</a>	<a ng-if="compare.full && !compare.has(result)" ng-click="compare.toggle(result)" class="ss-compare-button ss-pointer ss-disabled btn btn--block btn-main btn--info" alt="Cannot Compare">		<span class="ss-compare-button-label">Cannot Compare</span>	</a></script><!-- Compare - Product Box --><script type="text/ss-template" name="Compare - Product Box" target="#ss-compare-box">	<div class="ss-compare-box-text">		Compare Products	</div>	<a class="ss-compare-box-button ss-pointer" ng-click="compare.compare() && (compare.open = true);">Compare</a>	<ul class="ss-compare-box-item-container">		<li ng-repeat="selected in compare(4).selected track by selected.uid" class="ss-compare-box-item">			<img ng-src="{{ selected.thumbnailImageUrl ? selected.thumbnailImageUrl : \'//cdn.searchspring.net/ajax_search/img/default_image.png\' }}" onerror="this.src=\'//cdn.searchspring.net/ajax_search/img/default_image.png\';" alt="{{ selected.name }}" title="{{ selected.name }}" />			<a class="ss-remove ss-pointer" ng-click="compare.toggle(selected)"></a>		</li>	</ul></script><!-- Compare - Modal --><script type="text/ss-template" name="Compare - Modal" target="#ss-compare-modal">	<div class="ss-compare-modal-container">		<div class="ss-compare-modal-header">			<h4 class="ss-title">Compare Items</h4>			<a ng-click="compare.open = false" class="ss-close ss-pointer"></a>		</div>		<div class="ss-compare-modal-content">			<div class="ss-compare-modal-row">				<div class="ss-compare-modal-item-container ss-flex-nowrap">					<div class="ss-compare-modal-item-label"></div>					<div ng-repeat="result in compare.results" class="ss-compare-modal-item ss-compare-modal-item-image">						<a href="{{ result.url }}" class="ss-image-wrapper" intellisuggest>							<img ng-src="{{ result.thumbnailImageUrl ? result.thumbnailImageUrl : \'//cdn.searchspring.net/ajax_search/img/default_image.png\' }}" onerror="this.src=\'//cdn.searchspring.net/ajax_search/img/default_image.png\';" alt="{{ result.name }}" title="{{ result.name }}" />						</a>					</div>				</div>			</div>			<div class="ss-compare-modal-row">				<div class="ss-compare-modal-item-container ss-flex-nowrap">					<div class="ss-compare-modal-item-label"></div>					<div ng-repeat="result in compare.results" class="ss-compare-modal-item ss-compare-modal-item-name">						<a href="{{ result.url }}" intellisuggest>{{ result.name }}</a>					</div>				</div>			</div>			<div class="ss-compare-modal-row">				<div class="ss-compare-modal-item-container ss-flex-nowrap">					<div class="ss-compare-modal-item-label">SKU</div>					<div ng-repeat="result in compare.results" class="ss-compare-modal-item ss-compare-modal-item-price">						{{ result.customerPartNumber ? result.customerPartNumber : result.sku }}					</div>				</div>			</div>			<div class="ss-compare-modal-row" ng-repeat="field in compare.fields">				<div class="ss-compare-modal-item-container ss-flex-nowrap">					<div class="ss-compare-modal-item-label">{{ field.label }}</div>					<div ng-repeat="result in compare.results" ng-init="fieldArray = [result[field.key]]" class="ss-compare-modal-item">						<span ng-bind-html="fieldArray.join(\', \') || \'---\' | trusted"></span>					</div>				</div>			</div>		</div>	</div>	<div class="ss-compare-modal-overlay" ng-click="compare.open = false"></div></script><!-- SearchSpring Sidebar --><script type="text/ss-template" name="SearchSpring Sidebar" module="search" target="#searchspring-sidebar">	<aside ng-if="!slideout.triggered" class="ss-sidebar-container">		<div ng-if="filterSummary.length" class="ss-summary"></div>		<div ng-if="facets.length === 0" class="ss-filter-messages"></div>		<div ng-if="facets.length" class="ss-facets"></div>	</aside></script><!-- Filter Messages --><script type="text/ss-template" name="Filter Messages" target=".ss-filter-messages">	<p ng-if="pagination.totalResults === 0 && filterSummary.length === 0" class="ss-filter-message-content">		There are no results to refine. If you need additional help, please try our search "<strong>Suggestions</strong>".	</p>	<p ng-if="pagination.totalResults === 0 && filterSummary.length" class="ss-filter-message-content">		If you are not seeing any results, try removing some of your selected filters.	</p>	<p ng-if="pagination.totalResults && filterSummary.length === 0" class="ss-filter-message-content">		There are no filters to refine by.	</p></script><!-- Facets --><script type="text/ss-template" name="Facets" target=".ss-facets">	<article ng-repeat="facet in facets" ng-switch="facet.type" id="ss-{{ facet.field }}" class="ss-facet-container ss-facet-container-{{ facet.type ? facet.type : \'list\' }}" ng-class="{\'ss-expanded\': !facet.collapse, \'ss-collapsed\': facet.collapse}">		<h4 ng-click="facet.collapse = !facet.collapse; huyett.saveFilterState(facet, facet.collapse, tabs.current)" class="ss-title ss-pointer">{{ facet.label }}</h4>		<div class="ss-facet-options">			<div class="searchspring-search_within_facet">				<input					class="input input--full input--size-s"					type="text"					ng-model="facet.search.label"					placeholder="Filter by {{ facet.label }}"				/>			</div>			<div ng-switch-default class="ss-list" ng-class="{\'ss-scrollbar\': facet.overflow.remaining != facet.overflow.count}">				<div ng-repeat="value in facet.values | filter:facet.search | limitTo:facet.overflow.limit" class="ss-list-option" ng-class="{\'ss-active\': value.active}">					<a href="{{ value.url }}" class="ss-list-link ss-checkbox" ng-class="{\'ss-checkbox-round\': facet.multiple == \'single\'}">						{{ value.label }}					</a>				</div>			</div>			<div ng-if="facet.overflow.set(facet.limitCount).count" class="ss-show-more" ng-class="{\'ss-expanded\': facet.overflow.remaining, \'ss-collapsed\': !facet.overflow.remaining}">				<a ng-click="facet.overflow.toggle()" class="ss-show-more-link ss-pointer">					Show {{ facet.overflow.remaining ? \'More\' : \'Less\' }}				</a>			</div>		</div>	</article>	<div ng-if="merchandising.content.left.length > 0" id="ss-merch-left" class="ss-merchandising" ss-merchandising="left"></div></script><!-- Filter Summary --><script type="text/ss-template" name="Filter Summary" target=".ss-summary">	<div class="ss-summary-container">		<h4 ng-if="!slideout.triggered && !facets.horizontal" class="ss-title">Current Filters</h4>		<div class="ss-list ss-flex-wrap-center">			<div ng-if="slideout.triggered || facets.horizontal" class="ss-list-option ss-list-title">				<span class="ss-summary-label">Current Filters:</span>			</div>			<div ng-repeat="filter in filterSummary" class="ss-list-option">				<a href="{{ filter.remove.url }}" class="ss-list-link">					<span class="ss-summary-label">{{ filter.filterLabel }}:</span> <span class="ss-summary-value">{{ filter.filterValue }}</span>				</a>			</div>			<div class="ss-list-option ss-summary-reset">				<a href="{{ location().remove(\'filter\').remove(\'rq\').url() }}" class="ss-list-link">Clear All</a>			</div>		</div>	</div></script><!-- Pagination --><script type="text/ss-template" name="Pagination" target=".ss-pagination">	<div class=" datagrid-tool oro-pagination datagrid-tool oro-pagination" data-grid-pagination="">		<div class="oro-pagination__pager pager-custom">			<a				ng-if="pagination.previous"				role="button"				ng-href="{{ pagination.previous.url }}" 				class="btn btn--size-s btn--default oro-pagination__prev"				aria-label="Previous page"				tabindex="-1"			>				<span class="fa-angle-left" aria-hidden="true"></span>				<span class="oro-pagination__label" aria-hidden="true">Prev</span>			</a>			<a				ng-if="pagination.totalPages > 5 && pagination.currentPage > 3"				class="page-link"				ng-href="{{ pagination.first.url }}"				role="button"				aria-pressed="false"				tabindex="0"			>				<span class="visually-hidden">Page</span>{{ pagination.first.number }}			</a>			<span				ng-if="pagination.totalPages > 5 && pagination.currentPage > 3"				class="page-dots"				role="button"				aria-pressed="true"				tabindex="0"			>				<span class="visually-hidden">Page</span>...			</span>							<a				ng-repeat-start="page in pagination.getPages(5)"				ng-if="!page.active"				class="page-link"				ng-href="{{ page.url }}"				role="button"				aria-pressed="false"				tabindex="0"			>				<span class="visually-hidden">Page</span>{{ page.number }}			</a>			<span				ng-repeat-end				ng-if="page.active"				class="page-active"				role="button"				aria-pressed="true"				tabindex="0"			>				<span class="visually-hidden">Page</span>{{ page.number }}			</span>			<span				ng-if="pagination.totalPages > 5 && pagination.currentPage < (pagination.totalPages - 2)"				class="page-dots"				role="button"				aria-pressed="true"				tabindex="0"			>				<span class="visually-hidden">Page</span>...			</span>			<a				ng-if="pagination.totalPages > 5 && pagination.currentPage < (pagination.totalPages - 2)"				class="page-link"				ng-href="{{ pagination.last.url }}"				role="button"				aria-pressed="false"				tabindex="0"			>				<span class="visually-hidden">Page</span>{{ pagination.last.number }}			</a>			<a				ng-if="pagination.next"				ng-href="{{ pagination.next.url }}"				role="button"				class="btn btn--size-s btn--default oro-pagination__next"				aria-label="Next page"				tabindex="-1"			>				<span class="oro-pagination__label" aria-hidden="true">Next</span>				<span class="fa-angle-right" aria-hidden="true"></span>			</a>		</div>	</div></script><!-- Results & No Results --><script type="text/ss-template" name="Results &amp; No Results" module="search" target="#searchspring-content">	<section class="ss-content-container">		<div ng-if="compare.active && !compare.open" id="ss-compare-box"></div>		<div ng-if="compare.open && compare.results.length >= 2" id="ss-compare-modal"></div>		<div ng-if="pagination.totalResults" class="ss-results"></div>		<div ng-if="pagination.totalResults === 0" class="ss-no-results"></div>	</section></script><!-- Results --><script type="text/ss-template" name="Results" target=".ss-results">	<div ng-if="filterSummary.length && (slideout.triggered || facets.horizontal)" class="ss-summary ss-summary-horizontal"></div>	<div ng-if="merchandising.content.banner.length > 0" id="ss-merch-banner" class="ss-merchandising" ss-merchandising="banner"></div>	<div		ng-if="tabs.current == \'products\'"		class="ss-item-container ss-results-content test-grid-test-2 grid-body product-list product-list-wrap product-list--gallery-view"		ng-class="{\'plp-grid-view\': layout == \'grid\', \'plp-list-view\': layout == \'list\'}"	>	</div>		<div		ng-if="tabs.current == \'content\'"		class="ss-item-container ss-content-results plp-list-view"	>	</div>	<div ng-if="merchandising.content.footer.length > 0" id="ss-merch-footer" class="ss-merchandising" ss-merchandising="footer"></div></script><!-- I changed the target on this to not match as the customer says they\'ll inject results based on the events we\'re emitting --><!-- Results - Items --><script type="text/ss-template" name="Results - Items" target="#no-match .ss-results .ss-item-container.ss-results-content">	<div		id="product-id-{{ result.uid}}"		class="grid-row product-item product-item--gallery-view grid-row"		ng-repeat="result in results track by result.uid"	>		<div ng-if="result.isInlineBanner" class="ss-inline-banner" ng-bind-html="result.content | trusted"></div>		<div			ng-if="!result.isInlineBanner"			class=" product-item__base--gallery-view"			data-page-component-module="oroui/js/app/components/view-component"			data-layout="separate"		>			<div class=" product-item__box product-item__box--gallery-view">				<div					class=" product-item__content product-item__content--gallery-view"					itemscope=""					itemtype="http://schema.org/Product"				>					<div class=" product__specification product__specification--gallery-view">						<h2 class=" product-item__title product-item__title--gallery-view">							<a ng-href="{{ result.url }}" intellisuggest>								<span itemprop="name">{{ result.name }}</span>							</a>						</h2>						<div class=" product-item__number product-item__number--galler-view" ng-if="result.sku">							Sku #:							<span class="product-item__sku-value" itemprop="sku">								{{ result.customerPartNumber ? result.customerPartNumber : result.sku }}							</span>						</div>						<ul class="product-item__stock"></ul>					</div>					<div class=" product-item__primary-content product-item__primary-content--gallery-view">						<div class="product-item__primary-half product-item__primary-half--gallery-view">							<div class=" product__view-details-link product__view-details-link--gallery-view">								<a									ng-href="{{ result.url }}"									class="link view-product"									aria-label="View Details of the Current Product"									intellisuggest								>									View Details<span class="fa-angle-right fa--link-r" aria-hidden="true"></span>								</a>							</div>							<div class="product-item__image-holder--aspect-ratio product-item__image-holder product-item__image-holder--gallery-view">								<a									class=" product-item__preview"									ng-href="{{ result.url }}"									intellisuggest								>									<picture class=" product-item__preview-picture" data-object-fit="">										<img											ng-src="{{ result.thumbnailImageUrl }}"											class=" product-item__preview-image"											itemprop="image"											alt="{{ result.name }}"											loading="lazy"											onerror="this.src=\'//cdn.searchspring.net/ajax_search/img/default_image.png\'"										>									</picture>								</a>							</div>						</div>					</div>					<div class="test-test-list-item product-item__secondary-content product-item__secondary-content--gallery-view">						<div class=" product-item__secondary-half product-item__secondary-half--gallery-view product-item__secondary-half--last-gallery-view">							<div class=" product-item__qty product-item__qty--gallery-view" data-role="line-item-form-container">								<div class=" product-item__secondary-half product-item__secondary-half--gallery-view">									<div class=" product-price__container test-test-price">										<div class="product-price product-price__main">											<!--<div class="product-price-hint">												<div class="product-price-hint__prices">													<div class="price"><span class="product-price__label">Price:</span><span															class="product-price__main-box"><span																class="product-price__value-was">$0.2133</span><span																class="product-price__value">$0.1874</span></span>													</div>												</div>											</div>-->										</div>									</div>								</div>								<!-- id="oro_product_frontend_line_item-uid-6149efb831294-pid-28886" -->								<form									name="oro_product_frontend_line_item"									method="post"									data-ftid="oro_product_frontend_line_item"									data-name="form__oro-product-frontend-line-item"								>									<div										class=" product-item__qty__current-grid product-item__qty__current-grid--line_item_form_fields"										data-page-component-module="oroproduct/js/app/components/product-unit-select-component"									>										<div class="product-form-more-left">											<div class="product-minimum-order__container">												<div class="product-minimum-order__main">													<!--<span class="product-minimum-order__label">														Minimum Order Qty:													</span>													<span class="product-minimum-order__main-box">														<span class="product-minimum-order__qty">10</span>													</span>-->												</div>											</div>											<div class="product-qty-order__container">												<div class="product-qty-order__main">													<!--<span class="product-qty-order__label">Quantity:</span>													<span class="product-qty-order__main-box line_item_form_fields">														<input															class="product-item__qty-input input input--full input-widget"															type="text" placeholder="10"														>													</span>													<span class="product-qty-order__see-info">														<a href="#" class="btn-see-info">															See Quantity <span>Breaks</span>														</a>													</span>-->												</div>											</div>										</div>									</div>									<div class=" add-product-from-view-component">										<div class="product-form-more">											<div class="add-select-your-part">												<!--<select class="add-select">													<option selected="selected" value="best_match">														Add/Select Your Part														#</option>													<option value="date_asc">														Add/Select Part													</option>													<option value="name_asc">														Add/Select Part													</option>													<option value="name_desc">														Add/Select Part													</option>												</select>-->											</div>											<div class="product-no-charge-order__container">												<div class="product-no-charge-order__main">													<!--<input class="product-no-charge-order-input" type="checkbox">													<label class="product-no-charge-order-label">Request														No Charge Material														Cert</label>													<a href="#" class="btn-see-info-pop">														<span class="fa-info-circle fa--no-offset"></span>													</a>-->												</div>											</div>											<div class="plp-btn-add-to-cart">												<!--<a href="#" class="btn-add-to-cart">													<span>Add to Cart</span>												</a>-->											</div>										</div>										<div class="pull-right pinned-dropdown">											<div class="btn-group product-add-to-shopping-list-container">												<div class="btn-group--flex icons-holder btn-group--loading">													<!--<a														href="#"														class=" btn btn--block btn-main add-to-shopping-list-button btn--info"														data-id=""														role="button"													>														<span class="fa fa-shopping-cart fa--fw fa--аs-line" aria-hidden="true">														</span>Add to Shopping List													</a>-->												</div>											</div>										</div>										<div class="ss-compare-item-button"></div>									</div>								</form>							</div>						</div>					</div>				</div>			</div>		</div>	</div></script><style type="text/css">	.ss-content-result {		border: 2px solid transparent;		color: black;	}	.ss-content-result:hover {		border: 2px solid #ddd;		color: black;	}		.ss-content-result:hover {		text-decoration: none;	}</style><!-- Results - Items - Content --><script type="text/ss-template" name="Results - Items - Content" target=".ss-results .ss-item-container.ss-content-results">	<div		class="grid-row product-item product-item--gallery-view grid-row"		ng-repeat="result in results track by result.uid"	>		<div ng-if="result.isInlineBanner" class="ss-inline-banner" ng-bind-html="result.content | trusted"></div>		<a			ng-if="!result.isInlineBanner"			ng-href="{{ result.url }}"			intellisuggest			class=" product-item__base--gallery-view ss-content-result"		>			<div class=" product-item__box product-item__box--gallery-view">				<div					class=" product-item__content product-item__content--gallery-view"					ng-style="result.thumbnailImageUrl == results.defaultImage && {\'justify-content\': \'center\'}"				>					<div ng-if="result.thumbnailImageUrl !== results.defaultImage" class=" product-item__primary-content product-item__primary-content--gallery-view">						<div class="product-item__primary-half product-item__primary-half--gallery-view">							<div class="product-item__image-holder--aspect-ratio product-item__image-holder product-item__image-holder--gallery-view">								<picture class=" product-item__preview-picture" data-object-fit="">									<img										ng-src="{{ result.thumbnailImageUrl }}"										class=" product-item__preview-image"										itemprop="image"										alt="{{ result.name }}"										loading="lazy"										onerror="this.src=\'//cdn.searchspring.net/ajax_search/img/default_image.png\'"									>								</picture>							</div>						</div>					</div>					<div class="test-test-list-item product-item__secondary-content product-item__secondary-content--gallery-view">						<div class=" product__specification product__specification--gallery-view">							<h2 class=" product-item__title product-item__title--gallery-view">								<span itemprop="name">{{ result.name }}</span>							</h2>														<p style="font-size:14px;color:#666;margin: 16px 0 0;">{{ result.category }}</p>							<p ng-if="result.metadescription" class="ss-description" ng-bind-html="result.metadescription | truncate:250:\'&hellip;\' | trusted"></p>						</div>					</div>				</div>			</div>		</a>	</div></script><!-- No Results --><script type="text/ss-template" name="No Results" target=".ss-no-results">	<div class="ss-no-results-container">		<h3 ng-if="pagination.totalResults === 0 && subsearch.noResults.pagination.totalResults && q" class="ss-title ss-subsearch-title">			Your {{ tabs.current == \'products\' ? \'product\' : \'content\' }} search for "{{ q }}" returned no results. But we did find <a ng-click="tabs.changeTab(tabs.current == \'products\' ? \'content\' : \'products\')" class="ss-pointer">{{ subsearch.noResults.pagination.totalResults }} {{ tabs.current == \'products\' ? \'content\' : \'product\' }} results</a> for "{{ q }}".		</h3>		<p ng-if="didYouMean.query.length && (q && subsearch.noResults.pagination.totalResults)" class="ss-did-you-mean">			Or, did you mean to search for {{ tabs.current== \'products\' ? \'products\' : \'content\' }} related to "<a ng-click="didYouMeanClick()" class="ss-pointer">{{ didYouMean.query }}</a>"?		</p>		<p ng-if="didYouMean.query.length && (!q || !subsearch.noResults.pagination.totalResults)" class="ss-did-you-mean">			Did you mean "<a ng-click="didYouMeanClick()" class="ss-pointer">{{ didYouMean.query }}</a>"?		</p>	</div>	<div ng-if="merchandising.content.banner.length > 0" id="ss-merch-banner" class="ss-merchandising" ss-merchandising="banner"></div>	<div ng-if="filterSummary.length && (slideout.triggered || facets.horizontal)" class="ss-summary ss-summary-horizontal"></div>	<div class="ss-no-results-container">		<h4 class="ss-title">Suggestions</h4>		<ul class="ss-suggestion-list">			<li>Check for misspellings.</li>			<li>Remove possible redundant keywords (ie. "products").</li>			<li>Use other words to describe what you are searching for.</li>		</ul>		<p>Still can\'t find what you\'re looking for? <a href="/contact-us">Contact us</a>.</p>		<div class="ss-contact ss-phone">			<h4 class="ss-title">Call Us</h4>			<p>				<strong>Telephone:</strong> 785-392-3017<br />			</p>		</div>		<div class="ss-contact ss-email">			<h4 class="ss-title">Email</h4>			<p><a href="mailto:sales@huyett.com">sales@huyett.com</a></p>		</div>	</div>	<div ng-if="merchandising.content.footer.length > 0" id="ss-merch-footer" class="ss-merchandising" ss-merchandising="footer"></div> </script><!-- Slideout - Button --><script type="text/ss-template" name="Slideout - Button" target=".ss-slideout-toolbar">	<button ng-if="pagination.totalResults && facets.length > 0" class="ss-slideout-button ss-button ss-pointer" type="button" slideout>Filter Options</button></script><!-- Slideout - Menu --><script type="text/ss-template" name="Slideout - Menu" slideout="">	<div ng-if="facets.length > 0" class="ss-slideout-header">		<h4 class="ss-title">Filter Options</h4><a class="ss-close ss-pointer" slideout></a>	</div>	<aside ng-if="facets.length > 0 && slideout.triggered" class="ss-slideout-facets ss-sidebar-container ss-scrollbar" ng-swipe-left="slideout.toggleSlideout()">		<div class="ss-facets"></div>	</aside></script><!-- Toolbar - Top --><script type="text/ss-template" name="Toolbar - Top" target="#searchspring-toolbar">	<header ng-if="merchandising.content.header.length > 0" class="ss-header-container">		<div id="ss-merch-header" class="ss-merchandising" ss-merchandising="header"></div>	</header>		<div ng-if="slideout.triggered" class="ss-slideout-toolbar"></div>	<div data-grid-toolbar="top" class=" datagrid-toolbar__panel">		<div class="filter-box dropdown-mode" data-grid-toolbar>			<div class="filter-container" ng-if="pagination.totalResults > 0">				<div class="datagrid-manager">					<div class="default dropdown-menu ui-rewrite"						style="top: 2px; left: 0px;">						<div class="datagrid-manager__header">							<div class="ss-search-within">Search within results								<div class="datagrid-manager-search empty">									<form										id="searchspring-refine_search"										class="ss-flex-nowrap"										ng-submit="huyett.handleSearchWithinResults()"										ng-if="pagination.totalResults"									>										<input											type="text"											name="rq"											id="searchspring-refine_query"											placeholder="Keyword, Part #, Customer Part #, Product Description"											ng-model="query.rq"											autocomplete="off"											class="input input--full input--size-s input-with-search"										/>										<input											type="submit"											value="Search"											id="searchspring-refine_submit"											class="btn btn-main btn--info"										/>										<button											type="button"											class="btn btn--plain clear-search-button hide"											data-role="clear"											aria-label="Clear search field"										>									</form>								</div>							</div>						</div>					</div>				</div>			</div>		</div>	</div>	<div data-grid-toolbar="top" class="ss-flex">		<div data-grid-toolbar="top" class=" pull-left form-horizontal"			data-grid-items-counter="">			<div class="datagrid-tool">				<div class="oro-items-counter">					<h3 ng-if="pagination.totalResults" class="ss-title ss-results-title">						Showing <span ng-if="pagination.multiplePages" class="ss-results-count-range">{{ pagination.begin }} - {{ pagination.end }}</span> {{ pagination.multiplePages ? \'of\' : \'\' }} <span class="ss-results-count-total">{{ pagination.totalResults }}</span> result{{ pagination.totalResults == 1 ? \'\' : \'s\' }} {{ q ? \' for \' : \'\' }} <span ng-if="q" class="ss-results-query">"{{ q }}"</span>					</h3>					<h3 ng-if="pagination.totalResults === 0" class="ss-title ss-results-title ss-no-results-title">						No results {{ q ? \'for\' : \'\' }} <span ng-if="q" class="ss-results-query">"{{ q }}"</span> found.					</h3>					<div ng-if="originalQuery" class="ss-oq">						Search instead for "<a class="ss-oq-link" href="{{ originalQuery.url }}">{{ originalQuery.value }}</a>"					</div>				</div>			</div>		</div>	</div>	<div class="datagrid-toolbar__side" data-section="left-side" ng-if="tabs.current == \'products\' && pagination.totalResults > 0">		<div class=" datagrid-tool form-horizontal" data-grid-sorting>			<div data-grid-sorting ng-class="{\'select2-drop-below\': huyett.showSort}">				<span id="datagrid-toolbar-label-196" class="datagrid-tool__label">Sort by:</span>				<div					class="select2-container select2-container-single select2-container-with-searchbox oro-select2 oro-select2--size-s input-widget"					ng-class="{\'select2-dropdown-open select2-container-active\': huyett.showSort}"					id="s2id_autogen3"				>					<a						class="select2-choice"						ng-click="huyett.toggleSort($event)"						tabindex="-1"						role="combobox"						aria-owns="select2-results-199"						aria-labelledby="select2-chosen-200"						aria-haspopup="listbox"						aria-expanded="{{ huyett.showSort }}"					>						<span id="select2-chosen-200" class="select2-chosen" role="textbox" aria-readonly="true">							{{ sorting.current.label }}						</span>						<abbr class="select2-search-choice-close" aria-label="Clear selection" role="button"></abbr>						<span class="select2-arrow" aria-hidden="true">							<b></b>						</span>					</a>					<input						class="select2-focusser select2-offscreen"						type="text"						role="combobox"						aria-haspopup="true"						aria-expanded="{{ huyett.showSort }}"						aria-owns="select2-results-199"						aria-autocomplete="list"						id="s2id_autogen4"						aria-labelledby="datagrid-toolbar-label-196"					>					<div						class="select2-drop select2-with-searchbox oro-select2__dropdown"						ng-class="{\'select2-display-none\': !huyett.showSort}"						ng-click="$event.stopPropagation()"					>						<ul							class="select2-results"							id="select2-results-199"							role="listbox"							tabindex="-1"							aria-hidden="{{ !huyett.showSort }}"							aria-expanded="{{ huyett.showSort }}"						>							<li								ng-repeat="option in sorting.filteredOptions.length ? sorting.filteredOptions : sorting.options"								ng-mouseenter="huyett.toggleOptionHighlighting($event)"								ng-mouseleave="huyett.toggleOptionHighlighting($event)"								class="select2-results-dept-0 select2-result select2-result-selectable"								role="option"								aria-selected="false"							>								<div									class="select2-result-label"									ng-click="huyett.handleSelectOption(option)"								>									<span class="select2-match"></span>{{ option.label }}							</li>								</div>						</ul>					</div>				</div>			</div>		</div>	</div>	<div class="datagrid-toolbar__rightside" data-section="right-side" ng-if="pagination.totalResults > 0">		<div class=" datagrid-tool page-size datagrid-tool page-size" data-grid-pagesize>			<div class="page-size pull-right form-horizontal">				<span id="datagrid-toolbar-label-609e814b0dd26" class="datagrid-tool__label">View: &nbsp;</span>				<div class="action-selectbox-custom-in-pager">					<div						class="select2-container select2-container-single select2-container-with-searchbox oro-select2--size-s oro-select2"						ng-class="{\'select2-dropdown-open select2-container-active\': huyett.showPerPage}"						id="s2id_autogen5"					>						<a							class="select2-choice"							ng-click="huyett.togglePerPage($event)"							tabindex="-1"							role="combobox"							aria-owns="select2-results-756"							aria-labelledby="select2-chosen-757"							aria-haspopup="listbox"							aria-expanded="{{ huyett.showPerPage }}"						>							<span								id="select2-chosen-757"								class="select2-chosen"								role="textbox"								aria-readonly="true"							>								{{ pagination.perPage }} Per Page							</span>							<abbr class="select2-search-choice-close" aria-label="Clear selection" role="button">							</abbr>							<span class="select2-arrow" aria-hidden="{{ !huyett.showPerPage }}"><b></b></span>						</a>						<input							class="select2-focusser select2-offscreen"							type="text"							role="combobox"							aria-haspopup="true"							aria-expanded="{{ huyett.showPerPage }}"							aria-owns="select2-results-756"							aria-autocomplete="list"							id="s2id_autogen6"							aria-labelledby="datagrid-toolbar-label-609e814b0dd26"						>						<div							class="select2-drop select2-with-searchbox oro-select2__dropdown"							ng-class="{\'select2-display-none\': !huyett.showPerPage}"							ng-click="$event.stopPropagation()"						>							<ul								class="select2-results"								id="select2-results-756"								role="listbox"								tabindex="-1"								aria-hidden="{{ !huyett.showPerPage }}"								aria-expanded="{{ huyett.showPerPage }}"							>								<li									ng-repeat="n in huyett.filteredPerPageOptions.length ? huyett.filteredPerPageOptions : [12, 24, 36]"									ng-mouseenter="huyett.toggleOptionHighlighting($event)"									ng-mouseleave="huyett.toggleOptionHighlighting($event)"									class="select2-results-dept-0 select2-result select2-result-selectable"									role="option"									aria-selected="false"								>									<div										class="select2-result-label"										ng-click="huyett.handleSelectPerPage(n)"									>										<span class="select2-match"></span>{{ n }} Per Page								</li>							</ul>						</div>					</div>				</div>			</div>		</div>		<div class="datagrid-tool">			<div class=" catalog__filter-controls__item actions-panel form-horizontal catalog__filter-controls__item actions-panel form-horizontal actions-panel pull-right form-horizontal"				data-grid-actions-panel="">				<div class="btn-group not-expand frontend-datagrid__panel">					<a						role="button"						class="action btn btn--default btn--size-s btn-icon mode-icon-only"						title="Filter Toggle"						aria-label="Expand or Collapse Grid Filters"					>						<span class="icon fa-filter fa--no-offset fa--no-offset" aria-hidden="true"></span>					</a>				</div>			</div>		</div>		<div ng-if="tabs.current == \'products\'" class=" datagrid-tool display-options">			<span class="datagrid-tool__label">Display: &nbsp;</span>			<div class="btn-group catalog-switcher" role="group"				aria-label="Product Grid Views Toolbar">				<a					ng-click="layout == \'list\' ? swapLayout(\'grid\') : null"					ng-class="{\'active\': layout == \'grid\'}"					class="btn btn--default btn--size-s grid-view-icon"					aria-pressed="true"					aria-label="Gallery View"				>					<span class="fa-th fa--no-offset" aria-hidden="true"></span>				</a>				<a					ng-click="layout == \'grid\' ? swapLayout(\'list\') : null"					ng-class="{\'active\': layout == \'list\'}"					class="btn btn--default btn--size-s list-view-icon"					aria-pressed="false"					aria-label="List View"				>					<span class="fa-th-list fa--no-offset" aria-hidden="true"></span>				</a>			</div>		</div>	</div>	<div ng-if="pagination.totalPages > 1" class="ss-pagination datagrid-toolbar__base" data-section="base-side">	</div>		<div ng-if="huyett.isSearchPage && pagination.totalResults > 0" class="ss-tabs">		<div class="ss-list ss-flex">			<div ng-repeat="tab in tabs.values | orderBy: \'order\'" class="ss-list-option" ng-class="{\'ss-active\': tabs.current == tab.name}">				<a ng-click="tabs.changeTab(tab.name, false)" class="ss-list-link ss-pointer">{{ tab.label }}</a>			</div>		</div>	</div></script><!-- Toolbar - Bottom --><script type="text/ss-template" name="Toolbar - Bottom" target="#searchspring-toolbar-bottom">	<div class="datagrid-tool" ng-if="pagination.totalResults > 0 && pagination.totalPages > 1">		<div class="oro-items-counter">			Showing <span ng-if="pagination.multiplePages" class="ss-results-count-range">{{ pagination.begin }} - {{ pagination.end }}</span> {{ pagination.multiplePages ? \'of\' : \'\' }} <span class="ss-results-count-total">{{ pagination.totalResults }}</span> result{{ pagination.totalResults == 1 ? \'\' : \'s\' }} {{ q ? \' for \' : \'\' }} <span ng-if="q" class="ss-results-query">"{{ q }}"</span>		</div>	</div>	<div class=" datagrid-toolbar">		<div ng-if="pagination.totalPages > 1" class="ss-pagination datagrid-toolbar__base" data-section="base-side" >		</div>	</div></script>');
