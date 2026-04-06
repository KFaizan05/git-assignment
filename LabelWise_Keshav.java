/**
 * Student Name: Keshav Ravi
 * Team 2 - LabelWise
 * * This module implements:
 * 1. UC07: Share analysis to other platforms
 * 2. UC08: Compare 2 Products
 * 3. Integration Bridge: Send safe ingredients to Faizan's Recipe Engine
 */

import java.util.*;

class Product {
    String name;
    String status; 
    List<String> allIngredients;
    List<String> flaggedIngredients;

    public Product(String name, String status, List<String> all, List<String> flagged) {
        this.name = name;
        this.status = status;
        this.allIngredients = all;
        this.flaggedIngredients = flagged;
    }
}

public class LabelWise_Keshav {

    // UC08: Compare 2 Products side-by-side
    public void compareSavedProducts(Product p1, Product p2) {
        System.out.println("=== LabelWise Side-by-Side Comparison ===");
        System.out.println("Feature\t\t| " + p1.name + "\t\t| " + p2.name);
        System.out.println("---------------------------------------------------------");
        System.out.println("Safety Status\t| " + p1.status + "\t\t| " + p2.status);
        
        if (p1.status.equals("Safe") && !p2.status.equals("Safe")) {
            System.out.println("\nRecommendation: " + p1.name + " is better for your diet.");
        }
    }

    // UC07: Share analysis to other platforms
    public String exportAnalysis(Product p) {
        return "LabelWise Report: " + p.name + " is " + p.status + ".";
    }

    /**
     * INTEGRATION BRIDGE: 
     * This method filters safe ingredients to pass to Faizan's Recipe AI.
     */
    public List<String> getSafeIngredientsForFaizan(Product p) {
        List<String> safeOnly = new ArrayList<>(p.allIngredients);
        safeOnly.removeAll(p.flaggedIngredients);
        return safeOnly;
    }

    public static void main(String[] args) {
        LabelWise_Keshav keshavPart = new LabelWise_Keshav();

        // Sample Data
        List<String> all = List.of("Oats", "Sugar", "Honey");
        List<String> flagged = new ArrayList<>(); // None flagged
        Product myProduct = new Product("Organic Oats", "Safe", all, flagged);

        // 1. Share it (My UC)
        System.out.println(keshavPart.exportAnalysis(myProduct));

        // 2. Prep for Faizan's Branch (Integration)
        List<String> toSendToFaizan = keshavPart.getSafeIngredientsForFaizan(myProduct);
        System.out.println("Ready for Faizan's Recipe AI: " + toSendToFaizan);
    }
}