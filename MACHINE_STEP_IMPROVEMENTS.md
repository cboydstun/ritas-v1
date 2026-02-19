## 🧪 **TDD Implementation Plan: MachineStep Improvements**

### **Test-Driven Development Approach - Complete Strategy**

---

## 📋 **Phase 0: Setup & Planning**

### **Test File Structure**
```
src/components/order/steps/__tests__/
├── MachineStep.test.tsx           # Main component tests
├── MachineCard.test.tsx           # Machine card component
├── MixerCard.test.tsx             # Mixer card component  
├── MachineComparison.test.tsx     # Comparison table
├── SmartRecommendations.test.tsx  # Recommendation engine
└── __mocks__/
    ├── machineData.ts             # Mock machine data
    └── availabilityData.ts        # Mock availability
```

### **Testing Tools Required**
- Jest (already installed)
- React Testing Library
- @testing-library/user-event (for interactions)
- @testing-library/jest-dom (for assertions)
- Mock Service Worker (MSW) for API mocking

---

## 🔴 **Phase 1: RED - Write Failing Tests First**

### **1.1 Type Definitions Tests**
**File:** `src/types/__tests__/machine.test.ts`

**Test Suite: Machine Type Definitions**
- ✅ Test: MachineConfig interface has required fields
- ✅ Test: MachineType union type accepts valid values
- ✅ Test: MachineAvailability interface structure
- ✅ Test: MachineRecommendation interface structure
- ✅ Test: Type guards for machine validation

**What to test:**
- All required properties exist
- Optional properties are correctly typed
- Enums have correct values
- Type narrowing works correctly

---

### **1.2 Machine Card Component Tests**
**File:** `src/components/order/steps/__tests__/MachineCard.test.tsx`

**Test Suite: MachineCard Rendering**
- ✅ Test: Renders machine image
- ✅ Test: Displays machine name (15L Single Tank)
- ✅ Test: Shows guest capacity (20-30 guests)
- ✅ Test: Displays price per day
- ✅ Test: Shows "POPULAR" badge when isPopular=true
- ✅ Test: Shows availability status
- ✅ Test: Applies selected styling when isSelected=true
- ✅ Test: Applies disabled styling when isAvailable=false

**Test Suite: MachineCard Interactions**
- ✅ Test: Calls onSelect with machineType on click
- ✅ Test: Disabled card doesn't call onSelect
- ✅ Test: Hover effect applies on mouse enter
- ✅ Test: Focus styles for keyboard navigation
- ✅ Test: Accessibility - has proper ARIA labels

**Test Suite: MachineCard Edge Cases**
- ✅ Test: Handles missing image gracefully
- ✅ Test: Handles undefined price
- ✅ Test: Renders without optional props

---

### **1.3 Mixer Card Component Tests**
**File:** `src/components/order/steps/__tests__/MixerCard.test.tsx`

**Test Suite: MixerCard Rendering**
- ✅ Test: Displays mixer image
- ✅ Test: Shows mixer name
- ✅ Test: Displays price with + symbol
- ✅ Test: Shows checkbox checked state
- ✅ Test: Displays flavor description
- ✅ Test: Shows "No Mixer" option differently

**Test Suite: MixerCard Interactions**
- ✅ Test: Toggles selection on click
- ✅ Test: Prevents multiple selections for single tank
- ✅ Test: Allows multiple selections for multi-tank
- ✅ Test: Calls onChange with correct mixer type
- ✅ Test: Keyboard accessibility (Space/Enter)

---

### **1.4 Machine Comparison Table Tests**
**File:** `src/components/order/steps/__tests__/MachineComparison.test.tsx`

**Test Suite: Comparison Table Rendering**
- ✅ Test: Renders all machine types
- ✅ Test: Displays all comparison features
- ✅ Test: Shows checkmarks for included features
- ✅ Test: Highlights selected machine column
- ✅ Test: Mobile responsive - collapses correctly

**Test Suite: Comparison Logic**
- ✅ Test: Sorts features by importance
- ✅ Test: Compares numeric values correctly
- ✅ Test: Handles null/undefined feature values

---

### **1.5 Smart Recommendations Tests**
**File:** `src/components/order/steps/__tests__/SmartRecommendations.test.tsx`

**Test Suite: Recommendation Algorithm**
- ✅ Test: Suggests single tank for <30 guests
- ✅ Test: Suggests double tank for 30-60 guests
- ✅ Test: Suggests triple tank for 60+ guests
- ✅ Test: Factors in rental duration (multi-day)
- ✅ Test: Considers season (summer = higher capacity)
- ✅ Test: Weekend dates suggest popular choices
- ✅ Test: Returns null for invalid inputs

**Test Suite: Recommendation Display**
- ✅ Test: Shows recommendation message
- ✅ Test: Displays relevant icon
- ✅ Test: Allows dismissing recommendation
- ✅ Test: Persists dismissal to localStorage

---

### **1.6 Availability Indicator Tests**
**File:** `src/components/order/steps/__tests__/AvailabilityIndicator.test.tsx`

**Test Suite: Availability Display**
- ✅ Test: Shows green checkmark when available
- ✅ Test: Shows yellow warning for limited stock
- ✅ Test: Shows red X when unavailable
- ✅ Test: Displays stock count (e.g., "3 available")
- ✅ Test: Shows loading state while checking

**Test Suite: Availability Logic**
- ✅ Test: Fetches availability for selected dates
- ✅ Test: Caches availability data
- ✅ Test: Refetches on date change
- ✅ Test: Handles API errors gracefully
- ✅ Test: Debounces rapid date changes

---

### **1.7 Main MachineStep Integration Tests**
**File:** `src/components/order/steps/__tests__/MachineStep.test.tsx`

**Test Suite: Component Initialization**
- ✅ Test: Renders with default props
- ✅ Test: Pre-selects machine from formData
- ✅ Test: Pre-selects mixers from formData
- ✅ Test: Displays selected dates from previous step
- ✅ Test: Initializes at correct substep

**Test Suite: Machine Selection Flow**
- ✅ Test: Selecting machine updates formData
- ✅ Test: Changes machine image on selection
- ✅ Test: Progresses to mixer substep
- ✅ Test: Updates price calculation
- ✅ Test: Validates machine selection before next

**Test Suite: Mixer Selection Flow**
- ✅ Test: Single tank allows one mixer
- ✅ Test: Double tank allows two mixers
- ✅ Test: Triple tank allows three mixers
- ✅ Test: Prevents duplicate mixer selection
- ✅ Test: "No Mixer" clears all selections
- ✅ Test: Updates price with mixer selection

**Test Suite: Multi-Tank Tank Selection**
- ✅ Test: Shows tank tabs for multi-tank
- ✅ Test: Switches between tanks
- ✅ Test: Maintains selections per tank
- ✅ Test: Visual indicator of filled tanks
- ✅ Test: Validates all tanks have selections

**Test Suite: Progress & Navigation**
- ✅ Test: Shows substep progress dots
- ✅ Test: Highlights current substep
- ✅ Test: Advances substep on selection
- ✅ Test: Allows manual substep navigation
- ✅ Test: Validates before allowing next step

**Test Suite: Error Handling**
- ✅ Test: Shows error for no machine selected
- ✅ Test: Shows error for incomplete mixer selection
- ✅ Test: Clears errors on valid selection
- ✅ Test: Prevents progression with errors

**Test Suite: Accessibility**
- ✅ Test: All interactive elements have labels
- ✅ Test: Keyboard navigation works
- ✅ Test: Focus management is correct
- ✅ Test: Screen reader announcements
- ✅ Test: Color contrast meets WCAG standards

---

## 🟢 **Phase 2: GREEN - Implement Minimum Code to Pass**

### **2.1 Create Type Definitions**
**File:** `src/types/machine.ts`

**What to define:**
- MachineType enum or union type
- MachineConfig interface
- MachineAvailability interface  
- MachineRecommendation interface
- MixerCardProps interface
- MachineCardProps interface

**Run tests:** They should still fail (types exist but no components)

---

### **2.2 Create MachineCard Component**
**File:** `src/components/order/steps/MachineCard.tsx`

**Implementation order:**
1. Create basic component structure
2. Add props interface
3. Render machine image
4. Display machine details
5. Add click handler
6. Add styling for states
7. Add availability indicator
8. Add ARIA attributes

**Run tests after each addition:** Watch tests turn green one by one

---

### **2.3 Create MixerCard Component**
**File:** `src/components/order/steps/MixerCard.tsx`

**Implementation order:**
1. Create component structure
2. Render mixer image
3. Add checkbox
4. Handle selection logic
5. Add descriptions
6. Style different states
7. Add keyboard support

**Run tests:** Verify MixerCard tests pass

---

### **2.4 Create Supporting Components**
**In order:**
1. AvailabilityIndicator
2. MachineComparison
3. SmartRecommendations
4. TankSelector (for multi-tank)

**Each component:**
- Write component
- Run its test suite
- Verify all tests pass
- Commit when green

---

### **2.5 Refactor MachineStep**
**File:** `src/components/order/steps/MachineStep.tsx`

**Implementation order:**
1. Replace dropdown with card layout
2. Integrate MachineCard components
3. Add MixerCard components
4. Implement substep navigation
5. Add smart recommendations
6. Add availability checks
7. Update form state management

**Run integration tests frequently**

---

## 🔵 **Phase 3: REFACTOR - Improve Code Quality**

### **3.1 Extract Custom Hooks**
**File:** `src/hooks/__tests__/useMachineSelection.test.ts`

**Hook Tests:**
- ✅ Test: Returns machine selection state
- ✅ Test: Handles selection changes
- ✅ Test: Validates selections
- ✅ Test: Calculates prices correctly

**File:** `src/hooks/__tests__/useAvailability.test.ts`

**Hook Tests:**
- ✅ Test: Fetches availability data
- ✅ Test: Caches results
- ✅ Test: Handles loading states
- ✅ Test: Handles errors

**Refactor:** Extract logic into hooks, tests should still pass

---

### **3.2 Performance Optimization Tests**
**File:** `src/components/order/steps/__tests__/MachineStep.performance.test.tsx`

**Performance Tests:**
- ✅ Test: Component memoization works
- ✅ Test: No unnecessary re-renders
- ✅ Test: Large lists virtualized
- ✅ Test: Images lazy loaded

**Implement optimizations:** Verify tests pass

---

### **3.3 Integration Tests**
**File:** `src/components/order/__tests__/MachineStep.integration.test.tsx`

**End-to-End Scenarios:**
- ✅ Test: Complete machine + mixer selection flow
- ✅ Test: Change machine after mixer selection
- ✅ Test: Navigate back from next step
- ✅ Test: Form state persists correctly
- ✅ Test: Pricing updates in sidebar

---

## 📊 **Phase 4: Test Coverage & Quality**

### **4.1 Coverage Requirements**
**Minimum thresholds:**
- Line coverage: 90%
- Branch coverage: 85%
- Function coverage: 90%
- Statement coverage: 90%

**Generate report:**
```bash
npm test -- --coverage
```

---

### **4.2 Test Quality Checks**

**For each test:**
- ✅ Has descriptive name
- ✅ Tests one thing
- ✅ Arrange-Act-Assert pattern
- ✅ No test interdependencies
- ✅ Fast execution (<100ms)
- ✅ Deterministic (no flaky tests)

---

### **4.3 Snapshot Tests**
**When to use:**
- Component rendering (visual regression)
- Props variations
- Different states
- Error messages

**Update strategy:**
- Review snapshots on change
- Don't blindly update
- Keep snapshots small

---

## 🔄 **Phase 5: Continuous Testing**

### **5.1 Test Scripts**
**package.json additions:**
```
"test:watch" - Watch mode during development
"test:coverage" - Generate coverage report
"test:machine" - Run only MachineStep tests
"test:ci" - CI/CD pipeline tests
```

---

### **5.2 Pre-commit Hooks**
**Using Husky:**
1. Run affected tests
2. Check coverage thresholds
3. Lint test files
4. Prevent commit if tests fail

---

### **5.3 CI/CD Integration**
**GitHub Actions workflow:**
1. Run all tests on PR
2. Generate coverage report
3. Comment coverage on PR
4. Block merge if <90% coverage

---

## 🎯 **TDD Best Practices Applied**

### **1. Write Tests First**
- Never write code before test
- Think through requirements
- Design component API via tests

### **2. Minimal Implementation**
- Write simplest code to pass test
- No premature optimization
- Refactor only when green

### **3. Test Behavior, Not Implementation**
- Test what user sees/does
- Don't test internal state
- Don't test implementation details

### **4. Fast Feedback Loop**
- Run tests frequently
- Use watch mode
- Fix failures immediately

### **5. Maintainable Tests**
- Clear test names
- Shared test utilities
- DRY principles
- Good mocks

---

## 📦 **Mock Strategies**

### **API Mocking**
**Using MSW:**
- Mock /api/v1/availability
- Return different scenarios
- Test error states
- Test loading states

### **Component Mocking**
**When to mock:**
- External dependencies
- Heavy components
- Third-party libraries
- Not sibling components

### **Data Mocking**
**Factory pattern:**
- Machine data factory
- Mixer data factory
- Availability data factory
- User interaction factory

---

## ✅ **Definition of Done**

**A feature is complete when:**
1. ✅ All tests written first (RED)
2. ✅ Minimum code implemented (GREEN)
3. ✅ Code refactored (REFACTOR)
4. ✅ 90%+ test coverage
5. ✅ No flaky tests
6. ✅ Accessibility tests pass
7. ✅ Performance tests pass
8. ✅ Integration tests pass
9. ✅ Manual testing completed
10. ✅ Code reviewed

---

## 📈 **Estimated Timeline**

**Week 1: Testing Infrastructure**
- Day 1-2: Write type tests & implement types
- Day 3-4: Write MachineCard tests & implement
- Day 5: Write MixerCard tests & implement

**Week 2: Core Features**
- Day 1-2: Write comparison table tests & implement
- Day 3-4: Write recommendation tests & implement  
- Day 5: Write availability tests & implement

**Week 3: Integration & Polish**
- Day 1-2: Write main component integration tests
- Day 3: Refactor and optimize
- Day 4: Performance and accessibility
- Day 5: Documentation and review

---

## 🎓 **TDD Principles Summary**

1. **Red** → Write failing test
2. **Green** → Write minimal code to pass
3. **Refactor** → Improve code while keeping tests green
4. **Repeat** → For each feature/requirement

**Benefits:**
- ✅ Better design
- ✅ Living documentation
- ✅ Confidence to refactor
- ✅ Fewer bugs
- ✅ Faster development (long-term)

